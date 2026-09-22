'use client';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Action, type Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import {
  Activity,
  CircleDollarSign,
  Flag,
  HeartHandshake,
  Landmark,
  Plus,
  Target,
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
interface Fund extends Record<string, unknown> {
  _id: string;
  code: string;
  name: string;
  restriction: string;
  goalAmount?: number;
  status: string;
}
interface Campaign extends Record<string, unknown> {
  _id: string;
  code: string;
  name: string;
  fundId: string | Fund;
  goalAmount: number;
  startsAt: string;
  endsAt: string;
  status: string;
  ownerId: string | { name: string };
}
interface Pledge extends Record<string, unknown> {
  _id: string;
  pledgeNumber: string;
  alumniId: string | { fullName: string };
  campaignId: string | Campaign;
  amount: number;
  fulfilledAmount: number;
  dueAt: string;
  status: string;
}
interface Designation extends Record<string, unknown> {
  _id: string;
  donationId: string | { receiptNumber?: string; amount: number };
  fundId: string | Fund;
  amount: number;
  createdAt: string;
}
interface Task extends Record<string, unknown> {
  _id: string;
  alumniId: string | { fullName: string };
  subject: string;
  type: string;
  assignedTo: string | { name: string };
  dueAt: string;
  status: string;
}
interface Donation extends Record<string, unknown> {
  _id: string;
  receiptNumber?: string;
  amount: number;
  alumniId: string | { fullName: string };
  status: string;
}
interface Dash {
  activeFunds: number;
  activeCampaigns: number;
  pledged: number;
  designated: number;
  openTasks: number;
  overdueTasks: number;
  campaignPerformance: Array<{
    id: string;
    name: string;
    code: string;
    goal: number;
    pledged: number;
    designated: number;
    status: string;
  }>;
  pledgePipeline: Array<{ _id: string; count: number; amount: number }>;
  giftTrend: Array<{ _id: string; amount: number; count: number }>;
  taskPipeline: Array<{ _id: string; count: number }>;
}
type Modal = 'fund' | 'campaign' | 'pledge' | 'designation' | 'task' | 'close' | null;
const cls =
  'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15';
const n = (v: string | { name?: string; fullName?: string; code?: string }) =>
  typeof v === 'string' ? 'Linked record' : (v.fullName ?? v.name ?? v.code ?? 'Linked record');
const money = (v: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v);
export default function AdvancementPage() {
  const canCreate = useHasPermission('alumni', 'create');
  const canEdit = useHasPermission('alumni', 'edit');
  const canApprove = useHasPermission('alumni', 'approve');
  const [tab, setTab] = useState<
      'overview' | 'funds' | 'campaigns' | 'pledges' | 'gifts' | 'tasks'
    >('overview'),
    [modal, setModal] = useState<Modal>(null),
    [selected, setSelected] = useState<Task | null>(null);
  const { mutation, isLoading } = useMutation();
  const {
      data: dash,
      isLoading: dashboardLoading,
      mutate: rd,
    } = useSwr<Api<Dash>>('advancement/dashboard'),
    {
      data: fr,
      isLoading: fundsLoading,
      isValidating: fundsRefreshing,
      mutate: rf,
    } = useSwr<Api<Fund[]>>('advancement/funds'),
    {
      data: cr,
      isLoading: campaignsLoading,
      isValidating: campaignsRefreshing,
      mutate: rc,
    } = useSwr<Api<Campaign[]>>('advancement/campaigns'),
    {
      data: pr,
      isLoading: pledgesLoading,
      isValidating: pledgesRefreshing,
      mutate: rp,
    } = useSwr<Api<Pledge[]>>('advancement/pledges'),
    {
      data: gr,
      isLoading: giftsLoading,
      isValidating: giftsRefreshing,
      mutate: rg,
    } = useSwr<Api<Designation[]>>('advancement/designations'),
    {
      data: tr,
      isLoading: tasksLoading,
      isValidating: tasksRefreshing,
      mutate: rt,
    } = useSwr<Api<Task[]>>('advancement/tasks'),
    { data: dr } = useSwr<Api<{ data: Donation[] }>>('alumni/donations?limit=100');
  const funds = fr?.data ?? [],
    campaigns = cr?.data ?? [],
    pledges = pr?.data ?? [],
    gifts = gr?.data ?? [],
    tasks = tr?.data ?? [],
    donations = dr?.data?.data ?? [],
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
  const fcols: Column<Fund>[] = [
      {
        field: 'code',
        title: 'Fund',
        render: (r) => (
          <b>
            {r.code} · {r.name}
          </b>
        ),
      },
      { field: 'restriction', title: 'Restriction', render: (r) => <Badge v={r.restriction} /> },
      {
        field: 'goalAmount',
        title: 'Goal',
        render: (r) => (r.goalAmount ? money(r.goalAmount) : 'Open-ended'),
      },
      { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    ],
    ccols: Column<Campaign>[] = [
      {
        field: 'code',
        title: 'Campaign',
        render: (r) => (
          <div>
            <b>
              {r.code} · {r.name}
            </b>
            <p className="text-xs text-slate-600">{n(r.fundId)}</p>
          </div>
        ),
      },
      { field: 'goalAmount', title: 'Goal', render: (r) => money(r.goalAmount) },
      {
        field: 'startsAt',
        title: 'Period',
        render: (r) =>
          `${new Date(r.startsAt).toLocaleDateString('en-IN')} – ${new Date(r.endsAt).toLocaleDateString('en-IN')}`,
      },
      { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    ],
    pcols: Column<Pledge>[] = [
      {
        field: 'pledgeNumber',
        title: 'Pledge',
        render: (r) => (
          <div>
            <b>{r.pledgeNumber}</b>
            <p className="text-xs">{n(r.alumniId)}</p>
          </div>
        ),
      },
      { field: 'amount', title: 'Commitment', render: (r) => money(r.amount) },
      { field: 'fulfilledAmount', title: 'Fulfilled', render: (r) => money(r.fulfilledAmount) },
      {
        field: 'dueAt',
        title: 'Due',
        render: (r) => new Date(r.dueAt).toLocaleDateString('en-IN'),
      },
      { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    ],
    gcols: Column<Designation>[] = [
      {
        field: 'donationId',
        title: 'Confirmed gift',
        render: (r) =>
          typeof r.donationId === 'string'
            ? 'Donation'
            : (r.donationId.receiptNumber ?? money(r.donationId.amount)),
      },
      { field: 'fundId', title: 'Designation', render: (r) => n(r.fundId) },
      { field: 'amount', title: 'Amount', render: (r) => money(r.amount) },
      {
        field: 'createdAt',
        title: 'Recorded',
        render: (r) => new Date(r.createdAt).toLocaleDateString('en-IN'),
      },
    ],
    tcols: Column<Task>[] = [
      {
        field: 'subject',
        title: 'Stewardship',
        render: (r) => (
          <div>
            <b>{r.subject}</b>
            <p className="text-xs">
              {n(r.alumniId)} · {r.type.replaceAll('_', ' ')}
            </p>
          </div>
        ),
      },
      { field: 'assignedTo', title: 'Owner', render: (r) => n(r.assignedTo) },
      {
        field: 'dueAt',
        title: 'Due',
        render: (r) => (
          <span
            className={
              new Date(r.dueAt) < new Date() && r.status === 'open'
                ? 'text-red-600 font-semibold'
                : ''
            }
          >
            {new Date(r.dueAt).toLocaleDateString('en-IN')}
          </span>
        ),
      },
      { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    ],
    actions: Action<Task>[] = [
      {
        tooltip: 'Complete stewardship task',
        icon: <HeartHandshake className="h-4 w-4" />,
        hidden: (r) => r.status !== 'open',
        onClick: (r) => {
          setSelected(r);
          setModal('close');
        },
      },
    ];
  const tabs = [
    ['overview', 'Overview'],
    ['funds', 'Funds'],
    ['campaigns', 'Campaigns'],
    ['pledges', 'Pledges'],
    ['gifts', 'Gift designation'],
    ['tasks', 'Stewardship'],
  ] as const;
  const open = () =>
    setModal(
      tab === 'funds'
        ? 'fund'
        : tab === 'campaigns'
          ? 'campaign'
          : tab === 'pledges'
            ? 'pledge'
            : tab === 'gifts'
              ? 'designation'
              : 'task',
    );
  const cards: Array<[React.ElementType, string, string | number]> = [
    [Landmark, 'Active funds', d?.activeFunds ?? 0],
    [Target, 'Active campaigns', d?.activeCampaigns ?? 0],
    [CircleDollarSign, 'Committed', money(d?.pledged ?? 0)],
    [HeartHandshake, 'Designated gifts', money(d?.designated ?? 0)],
    [Users, 'Open stewardship', d?.openTasks ?? 0],
    [Flag, 'Overdue follow-ups', d?.overdueTasks ?? 0],
  ];
  const tabActionAllowed = tab === 'gifts' ? canApprove : canCreate;
  return (
    <div className="space-y-5 pb-8">
      <header>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Alumni relations
          </p>
          <h1 className="text-2xl font-black">Advancement & Fundraising</h1>
          <p className="text-sm text-slate-500">
            Turn trusted alumni relationships into governed campaigns, gifts, pledges and measurable
            stewardship.
          </p>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === k ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {l}
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <AdvancementOverview
          data={d}
          cards={cards}
          loading={dashboardLoading}
          refresh={() => rd()}
        />
      )}
      {tab === 'funds' && (
        <CustomTable
          title="Advancement funds"
          description="Purpose-controlled destinations for alumni gifts and campaign proceeds."
          data={funds}
          columns={fcols}
          isLoading={fundsLoading}
          isValidating={fundsRefreshing}
          onRefresh={() => rf()}
          customActions={canCreate ? <TableAdd label="Create fund" action={open} /> : undefined}
          options={{ responsive: true, export: true, refresh: true, search: true, bordered: false }}
        />
      )}
      {tab === 'campaigns' && (
        <CustomTable
          title="Campaign portfolio"
          description="Fundraising initiatives, ownership, timelines and financial targets."
          data={campaigns}
          columns={ccols}
          isLoading={campaignsLoading}
          isValidating={campaignsRefreshing}
          onRefresh={() => rc()}
          customActions={canCreate ? <TableAdd label="Create campaign" action={open} /> : undefined}
          options={{ responsive: true, export: true, refresh: true, search: true, bordered: false }}
        />
      )}
      {tab === 'pledges' && (
        <CustomTable
          title="Pledge pipeline"
          description="Alumni commitments, due dates and fulfillment progress against campaigns."
          data={pledges}
          columns={pcols}
          isLoading={pledgesLoading}
          isValidating={pledgesRefreshing}
          onRefresh={() => rp()}
          customActions={canCreate ? <TableAdd label="Record pledge" action={open} /> : undefined}
          options={{ responsive: true, export: true, refresh: true, search: true, bordered: false }}
        />
      )}
      {tab === 'gifts' && (
        <CustomTable
          title="Confirmed gift designations"
          description="Allocation of confirmed contributions to governed funds, campaigns and pledges."
          data={gifts}
          columns={gcols}
          isLoading={giftsLoading}
          isValidating={giftsRefreshing}
          onRefresh={() => rg()}
          customActions={canApprove ? <TableAdd label="Designate gift" action={open} /> : undefined}
          options={{ responsive: true, export: true, refresh: true, search: true, bordered: false }}
        />
      )}
      {tab === 'tasks' && (
        <CustomTable
          title="Stewardship worklist"
          description="Owned alumni follow-ups with due dates, outcomes and relationship accountability."
          data={tasks}
          columns={tcols}
          actions={canEdit ? actions : []}
          isLoading={tasksLoading}
          isValidating={tasksRefreshing}
          onRefresh={() => rt()}
          customActions={canCreate ? <TableAdd label="Create task" action={open} /> : undefined}
          options={{ responsive: true, export: true, refresh: true, search: true, bordered: false }}
        />
      )}
      {modal === 'fund' && tabActionAllowed && (
        <FundForm
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) => save('advancement/funds', v, 'Fund created', rf)}
        />
      )}{' '}
      {modal === 'campaign' && canCreate && (
        <CampaignForm
          funds={funds}
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) => save('advancement/campaigns', v, 'Campaign created', rc)}
        />
      )}{' '}
      {modal === 'pledge' && canCreate && (
        <PledgeForm
          campaigns={campaigns}
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) => save('advancement/pledges', v, 'Pledge recorded', rp)}
        />
      )}{' '}
      {modal === 'designation' && canApprove && (
        <DesignationForm
          donations={donations.filter((x) => x.status === 'confirmed')}
          funds={funds}
          campaigns={campaigns}
          pledges={pledges}
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) => save('advancement/designations', v, 'Gift designated', rg)}
        />
      )}{' '}
      {modal === 'task' && canCreate && (
        <TaskForm
          campaigns={campaigns}
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) => save('advancement/tasks', v, 'Stewardship task created', rt)}
        />
      )}{' '}
      {modal === 'close' && selected && canEdit && (
        <CloseForm
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) =>
            save(
              `advancement/tasks/${selected._id}/complete`,
              v,
              'Stewardship task completed',
              rt,
              'PATCH',
            )
          }
        />
      )}
    </div>
  );
}

function TableAdd({ label, action }: { label: string; action: () => void }) {
  return (
    <CustomButton startIcon={<Plus className="h-4 w-4" />} onClick={action} className="w-fit!">
      {label}
    </CustomButton>
  );
}

function AdvancementOverview({
  data,
  cards,
  loading,
  refresh,
}: {
  data?: Dash;
  cards: Array<[React.ElementType, string, string | number]>;
  loading: boolean;
  refresh: () => void;
}) {
  return (
    <section className="space-y-4" aria-label="Advancement analytics">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Fundraising intelligence</h2>
          <p className="text-sm text-slate-500">
            Campaign performance, pledge conversion, designated gifts and stewardship health.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary"
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([Icon, label, value], index) => {
          const tones = [
            'bg-blue-50 text-blue-700',
            'bg-violet-50 text-violet-700',
            'bg-amber-50 text-amber-700',
            'bg-emerald-50 text-emerald-700',
            'bg-cyan-50 text-cyan-700',
            'bg-rose-50 text-rose-700',
          ];
          return (
            <article
              key={label}
              className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[index]}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold leading-5 text-slate-600">{label}</p>
              </div>
              <p className="shrink-0 text-right text-xl font-black text-slate-950 sm:text-2xl">
                {loading ? '—' : value}
              </p>
            </article>
          );
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <AnalyticsCard
          title="Campaign progress"
          description="Designated income and outstanding pledges against each campaign target."
          icon={<Target className="h-5 w-5 text-primary" />}
        >
          <CampaignChart data={data?.campaignPerformance ?? []} />
        </AnalyticsCard>
        <AnalyticsCard
          title="Gift momentum"
          description="Confirmed gift value designated during each recorded month."
          icon={<Activity className="h-5 w-5 text-emerald-600" />}
        >
          <GiftTrend data={data?.giftTrend ?? []} />
        </AnalyticsCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PipelinePanel
          title="Pledge pipeline"
          description="Commitments by their current fulfillment state."
          data={(data?.pledgePipeline ?? []).map((item) => ({
            label: item._id,
            value: item.count,
            detail: money(item.amount),
          }))}
        />
        <PipelinePanel
          title="Stewardship workload"
          description="Relationship follow-ups by completion state."
          data={(data?.taskPipeline ?? []).map((item) => ({
            label: item._id,
            value: item.count,
            detail: `${item.count} task${item.count === 1 ? '' : 's'}`,
          }))}
        />
      </div>
    </section>
  );
}

function AnalyticsCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function CampaignChart({ data }: { data: Dash['campaignPerformance'] }) {
  if (!data.length)
    return (
      <ChartEmpty text="Campaign performance appears after campaigns receive pledges or gifts." />
    );
  return (
    <div className="space-y-4">
      {data.slice(0, 6).map((item) => (
        <div key={item.id}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-slate-700">
              {item.code} · {item.name}
            </span>
            <span className="shrink-0 text-slate-500">
              {money(item.designated)} / {money(item.goal)}
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-violet-200"
              style={{ width: `${Math.min(100, (item.pledged / Math.max(item.goal, 1)) * 100)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{
                width: `${Math.min(100, (item.designated / Math.max(item.goal, 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-primary" />
          Designated
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-violet-200" />
          Pledged
        </span>
      </div>
    </div>
  );
}

function GiftTrend({ data }: { data: Dash['giftTrend'] }) {
  if (!data.length)
    return <ChartEmpty text="Monthly gift trends appear after confirmed gifts are designated." />;
  const visible = data.slice(-10);
  const max = Math.max(...visible.map((item) => item.amount), 1);
  const x = (index: number) => 34 + (index * 532) / Math.max(visible.length - 1, 1);
  const y = (value: number) => 150 - (value / max) * 112;
  const points = visible.map((item, index) => `${x(index)},${y(item.amount)}`).join(' ');
  return (
    <svg
      viewBox="0 0 600 185"
      role="img"
      aria-label="Monthly designated gift trend"
      className="h-48 w-full min-w-[480px]"
    >
      <defs>
        <linearGradient id="giftFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[38, 75, 112, 150].map((line) => (
        <line
          key={line}
          x1="34"
          x2="566"
          y1={line}
          y2={line}
          stroke="#e2e8f0"
          strokeDasharray="4 5"
        />
      ))}
      <polygon points={`34,150 ${points} 566,150`} fill="url(#giftFill)" />
      <polyline
        points={points}
        fill="none"
        stroke="#059669"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {visible.map((item, index) => (
        <g key={item._id}>
          <circle
            cx={x(index)}
            cy={y(item.amount)}
            r="4"
            fill="white"
            stroke="#059669"
            strokeWidth="2.5"
          >
            <title>{`${item._id}: ${money(item.amount)}`}</title>
          </circle>
          <text x={x(index)} y="174" textAnchor="middle" fontSize="9" fill="#64748b">
            {item._id.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function PipelinePanel({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: Array<{ label: string; value: number; detail: string }>;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500">{description}</p>
      {data.length ? (
        <div className="mt-5 space-y-4">
          {data.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="font-semibold capitalize text-slate-600">
                  {item.label.replaceAll('_', ' ')}
                </span>
                <span className="text-slate-500">{item.detail}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ChartEmpty text="No workflow records available yet." />
      )}
    </article>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-slate-200 px-5 text-center text-sm text-slate-500">
      {text}
    </div>
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
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const guidance: Record<string, string> = {
    'Create advancement fund':
      'Define the controlled purpose where confirmed gifts may be allocated. Restrictions become part of the financial audit trail.',
    'Create campaign':
      'Connect a time-bound fundraising initiative to one governed fund, a measurable target and an accountable owner.',
    'Record pledge':
      'Capture a verified alumnus commitment. Receiving money remains a separate, auditable contribution workflow.',
    'Designate confirmed gift':
      'Allocate only received and confirmed money. The selected fund must remain consistent with any campaign or pledge.',
    'Create stewardship task':
      'Assign a relationship follow-up to a responsible staff member with a clear due date.',
    'Complete stewardship task':
      'Record the actual interaction outcome so the alumni relationship history remains meaningful.',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 sm:items-center sm:p-4">
      <div className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 sm:rounded-2xl sm:p-6">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Guided advancement workflow
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{guidance[title]}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close form"
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
function Err({ n }: { n: string }) {
  return <ErrorMessage name={n}>{(m) => <p className="text-xs text-red-500">{m}</p>}</ErrorMessage>;
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
function FundForm({
  close,
  loading,
  submit,
}: {
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Create advancement fund" close={close}>
      <Formik
        initialValues={{
          code: '',
          name: '',
          purpose: '',
          restriction: 'unrestricted',
          goalAmount: 0,
          status: 'active',
        }}
        validationSchema={Yup.object({
          code: Yup.string().required(),
          name: Yup.string().required(),
          purpose: Yup.string().min(5).required(),
          goalAmount: Yup.number().min(0),
        })}
        onSubmit={submit}
      >
        {() => (
          <Form className="grid gap-3 sm:grid-cols-2">
            {[
              ['code', 'Code *'],
              ['name', 'Name *'],
              ['goalAmount', 'Goal amount'],
            ].map(([x, l]) => (
              <label key={x} className="text-sm">
                {l}
                <Field name={x} type={x === 'goalAmount' ? 'number' : 'text'} className={cls} />
                <Err n={x} />
              </label>
            ))}
            <label className="text-sm">
              Restriction
              <Field as="select" name="restriction" className={cls}>
                {['unrestricted', 'temporarily_restricted', 'permanently_restricted'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Field>
            </label>
            <label className="text-sm sm:col-span-2">
              Purpose *<Field as="textarea" name="purpose" className={cls} />
              <Err n="purpose" />
            </label>
            <Submit loading={loading} label="Create fund" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function CampaignForm({
  funds,
  close,
  loading,
  submit,
}: {
  funds: Fund[];
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Create campaign" close={close}>
      <Formik
        initialValues={{
          code: '',
          name: '',
          description: '',
          fundId: '',
          goalAmount: 1,
          startsAt: '',
          endsAt: '',
          ownerId: '',
          status: 'active',
        }}
        validationSchema={Yup.object({
          code: Yup.string().required(),
          name: Yup.string().required(),
          description: Yup.string().min(5).required(),
          fundId: Yup.string().required(),
          goalAmount: Yup.number().positive().required(),
          startsAt: Yup.date().required(),
          endsAt: Yup.date().min(Yup.ref('startsAt')).required(),
          ownerId: Yup.string().required(),
        })}
        onSubmit={submit}
      >
        {({ values, setFieldValue }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Fund *
              <Field as="select" name="fundId" className={cls}>
                <option value="">Select fund</option>
                {funds
                  .filter((f) => f.status !== 'closed')
                  .map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.code} · {f.name}
                    </option>
                  ))}
              </Field>
            </label>
            {[
              ['code', 'Code *'],
              ['name', 'Name *'],
              ['goalAmount', 'Goal *'],
            ].map(([x, l]) => (
              <label key={x} className="text-sm">
                {l}
                <Field name={x} type={x === 'goalAmount' ? 'number' : 'text'} className={cls} />
              </label>
            ))}
            <label className="text-sm">
              Starts *<Field type="date" name="startsAt" className={cls} />
            </label>
            <label className="text-sm">
              Ends *<Field type="date" name="endsAt" className={cls} />
            </label>
            <AsyncSelect
              type="users"
              label="Campaign owner"
              required
              value={values.ownerId}
              onChange={(v) => setFieldValue('ownerId', v ?? '')}
            />
            <label className="text-sm sm:col-span-2">
              Description *<Field as="textarea" name="description" className={cls} />
            </label>
            <Submit loading={loading} label="Create campaign" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function PledgeForm({
  campaigns,
  close,
  loading,
  submit,
}: {
  campaigns: Campaign[];
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Record pledge" close={close}>
      <Formik
        initialValues={{
          alumniId: '',
          campaignId: '',
          fundId: '',
          amount: 1,
          dueAt: '',
          notes: '',
        }}
        validationSchema={Yup.object({
          alumniId: Yup.string().required(),
          campaignId: Yup.string().required(),
          fundId: Yup.string().required(),
          amount: Yup.number().positive().required(),
          dueAt: Yup.date().required(),
        })}
        onSubmit={submit}
      >
        {({ values, setFieldValue }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <AsyncSelect
              type="alumni"
              label="Alumni donor"
              required
              value={values.alumniId}
              onChange={(v) => setFieldValue('alumniId', v ?? '')}
            />
            <label className="text-sm">
              Campaign *
              <Field
                as="select"
                name="campaignId"
                className={cls}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const c = campaigns.find((x) => x._id === e.target.value);
                  setFieldValue('campaignId', e.target.value);
                  setFieldValue(
                    'fundId',
                    c ? (typeof c.fundId === 'string' ? c.fundId : c.fundId._id) : '',
                  );
                }}
              >
                <option value="">Select campaign</option>
                {campaigns
                  .filter((c) => ['active', 'draft'].includes(c.status))
                  .map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
              </Field>
            </label>
            <label className="text-sm">
              Amount *<Field type="number" name="amount" className={cls} />
            </label>
            <label className="text-sm">
              Due *<Field type="date" name="dueAt" className={cls} />
            </label>
            <label className="text-sm sm:col-span-2">
              Notes
              <Field name="notes" className={cls} />
            </label>
            <Submit loading={loading} label="Record pledge" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function DesignationForm({
  donations,
  funds,
  campaigns,
  pledges,
  close,
  loading,
  submit,
}: {
  donations: Donation[];
  funds: Fund[];
  campaigns: Campaign[];
  pledges: Pledge[];
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const options: Array<[string, string, Array<[string, string]>]> = [
    [
      'donationId',
      'Confirmed donation',
      donations.map((x) => [
        x._id,
        `${x.receiptNumber ?? 'Confirmed'} · ${money(x.amount)} · ${n(x.alumniId)}`,
      ]),
    ],
    [
      'fundId',
      'Fund',
      funds.filter((x) => x.status !== 'closed').map((x) => [x._id, `${x.code} · ${x.name}`]),
    ],
    ['campaignId', 'Campaign (optional)', campaigns.map((x) => [x._id, `${x.code} · ${x.name}`])],
    [
      'pledgeId',
      'Pledge fulfillment (optional)',
      pledges
        .filter((x) => ['active', 'partially_fulfilled'].includes(x.status))
        .map((x) => [x._id, `${x.pledgeNumber} · ${money(x.amount - x.fulfilledAmount)}`]),
    ],
  ];
  return (
    <Shell title="Designate confirmed gift" close={close}>
      <Formik
        initialValues={{ donationId: '', fundId: '', campaignId: '', pledgeId: '', amount: 1 }}
        validationSchema={Yup.object({
          donationId: Yup.string().required(),
          fundId: Yup.string().required(),
          amount: Yup.number().positive().required(),
        })}
        onSubmit={submit}
      >
        {() => (
          <Form className="grid gap-3 sm:grid-cols-2">
            {options.map(([key, label, values]) => (
              <label key={key} className="text-sm">
                {label}
                <Field as="select" name={key} className={cls}>
                  <option value="">Select</option>
                  {values.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </Field>
              </label>
            ))}
            <label className="text-sm">
              Amount *<Field type="number" name="amount" className={cls} />
            </label>
            <Submit loading={loading} label="Designate gift" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function TaskForm({
  campaigns,
  close,
  loading,
  submit,
}: {
  campaigns: Campaign[];
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Create stewardship task" close={close}>
      <Formik
        initialValues={{
          alumniId: '',
          campaignId: '',
          type: 'call',
          subject: '',
          dueAt: '',
          assignedTo: '',
        }}
        validationSchema={Yup.object({
          alumniId: Yup.string().required(),
          type: Yup.string().required(),
          subject: Yup.string().required(),
          dueAt: Yup.date().required(),
          assignedTo: Yup.string().required(),
        })}
        onSubmit={submit}
      >
        {({ values, setFieldValue }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <AsyncSelect
              type="alumni"
              label="Alumni constituent"
              required
              value={values.alumniId}
              onChange={(v) => setFieldValue('alumniId', v ?? '')}
            />
            <AsyncSelect
              type="users"
              label="Task owner"
              required
              value={values.assignedTo}
              onChange={(v) => setFieldValue('assignedTo', v ?? '')}
            />
            <label className="text-sm">
              Campaign
              <Field as="select" name="campaignId" className={cls}>
                <option value="">Relationship-wide</option>
                {campaigns.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Type
              <Field as="select" name="type" className={cls}>
                {['call', 'meeting', 'proposal', 'thank_you', 'impact_report', 'other'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Subject *<Field name="subject" className={cls} />
            </label>
            <label className="text-sm">
              Due *<Field type="date" name="dueAt" className={cls} />
            </label>
            <Submit loading={loading} label="Create task" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function CloseForm({
  close,
  loading,
  submit,
}: {
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Complete stewardship task" close={close}>
      <Formik
        initialValues={{ outcome: '' }}
        validationSchema={Yup.object({ outcome: Yup.string().min(3).required() })}
        onSubmit={submit}
      >
        {() => (
          <Form className="space-y-3">
            <label className="text-sm">
              Outcome *<Field as="textarea" name="outcome" className={cls} />
              <Err n="outcome" />
            </label>
            <Submit loading={loading} label="Complete task" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

'use client';

import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import {
  Activity,
  Building2,
  Briefcase,
  CheckCircle2,
  Eye,
  GraduationCap,
  HandCoins,
  MapPin,
  Pencil,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import DonationsTab from './DonationsTab';
import EngagementTab from './EngagementTab';
import { IAlumni, IGraduationCandidate } from '../types/alumni.types';

type TTab = 'overview' | 'directory' | 'graduation' | 'engagement' | 'donations';
const fieldClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15';

export default function AlumniPage() {
  const canEdit = useHasPermission('alumni', 'edit');
  const canApprove = useHasPermission('alumni', 'approve');
  const canManage = canEdit || canApprove;
  const [tab, setTab] = useState<TTab>('overview');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [verified, setVerified] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<IAlumni | null>(null);
  const { mutation, isLoading: acting } = useMutation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  const url = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: '15' });
    if (debouncedSearch) query.set('search', debouncedSearch);
    if (verified) query.set('isVerified', verified);
    return `alumni?${query}`;
  }, [page, debouncedSearch, verified]);
  const { data: raw, error, isLoading, isValidating, mutate } = useSwr(url);
  const records = (raw as { data?: IAlumni[] })?.data ?? [];
  const total = (raw as { total?: number })?.total ?? records.length;

  const verify = async (row: IAlumni) => {
    const result = await Swal.fire({
      title: 'Verify alumni identity?',
      text: 'The system will match this profile to an authoritative passed-out student record.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Verify identity',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`alumni/${row._id}/verify`, { method: 'PUT' });
    if (!response?.results?.success) return;
    toast.success('Alumni identity verified');
    mutate();
  };
  const verifyCareer = async (row: IAlumni) => {
    const response = await mutation(`alumni/${row._id}/career/verify`, { method: 'PUT' });
    if (!response?.results?.success) return;
    toast.success('Career outcome verified');
    mutate();
  };
  const columns: Column<IAlumni>[] = [
    {
      field: 'fullName',
      title: 'Alumni',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">{row.fullName}</p>
          <p className="text-xs text-slate-600">{row.rollNumber || row.email}</p>
        </div>
      ),
    },
    { field: 'program', title: 'Program', render: (row) => `${row.program} · ${row.branch}` },
    { field: 'passoutYear', title: 'Passed out' },
    {
      field: 'currentEmployer',
      title: 'Current outcome',
      render: (row) =>
        row.isPlaced
          ? `${row.currentDesignation || 'Professional'} · ${row.currentEmployer || '—'}`
          : row.higherStudies
            ? `${row.higherStudies.program} · ${row.higherStudies.institution}`
            : 'Not updated',
    },
    {
      field: 'isVerified',
      title: 'Identity',
      render: (row) => <Status ok={row.isVerified} yes="Verified" no="Pending" />,
    },
    {
      field: 'careerOutcomeVerified',
      title: 'Career',
      render: (row) => <Status ok={row.careerOutcomeVerified} yes="Verified" no="Pending" />,
    },
  ];
  const actions: Action<IAlumni>[] = [
    { icon: <Eye size={15} />, tooltip: 'View profile', onClick: (row) => setDetailId(row._id) },
    ...(canManage
      ? ([
          {
            icon: <Pencil size={15} />,
            tooltip: 'Update career outcome',
            onClick: (row: IAlumni) => setEditing(row),
          },
          {
            icon: <CheckCircle2 size={15} />,
            tooltip: 'Verify identity',
            onClick: verify,
            hidden: (row: IAlumni) => row.isVerified,
          },
          {
            icon: <Briefcase size={15} />,
            tooltip: 'Verify career outcome',
            onClick: verifyCareer,
            hidden: (row: IAlumni) => !row.isVerified || row.careerOutcomeVerified,
          },
        ] as Action<IAlumni>[])
      : []),
  ];
  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: <Activity /> },
    { key: 'directory' as const, label: 'Alumni directory', icon: <Users /> },
    ...(canApprove
      ? [{ key: 'graduation' as const, label: 'Graduation clearance', icon: <GraduationCap /> }]
      : []),
    { key: 'engagement' as const, label: 'Engagement & mentoring', icon: <Briefcase /> },
    { key: 'donations' as const, label: 'Contributions', icon: <HandCoins /> },
  ];

  return (
    <div className="space-y-5 pb-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Graduate to lifelong engagement
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Alumni Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Govern graduation, verify identity and career outcomes, and account for contributions.
        </p>
      </header>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === item.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="[&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Alumni records could not be loaded. Refresh and try again; no placeholder profiles are
          shown.
        </div>
      )}
      {tab === 'overview' ? (
        <AlumniOverview />
      ) : tab === 'donations' ? (
        <DonationsTab />
      ) : tab === 'engagement' ? (
        <EngagementTab />
      ) : tab === 'graduation' && canApprove ? (
        <GraduationWorkspace />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, roll number or employer"
              className={`${fieldClass} min-w-64 flex-1`}
            />
            <select
              value={verified}
              onChange={(event) => {
                setVerified(event.target.value);
                setPage(1);
              }}
              className={`${fieldClass} w-full sm:w-56`}
            >
              <option value="">All verification states</option>
              <option value="true">Identity verified</option>
              <option value="false">Identity pending</option>
            </select>
          </div>
          <DataViewSwitcher
            data={records}
            isLoading={isLoading}
            storageKey="alumni.directory.view"
            showSearch={false}
            emptyMessage="No alumni match these filters"
            emptySubTitle="Graduated and verified profiles will appear in this directory."
            renderCard={(row) => (
              <div className="flex h-full flex-col rounded-2xl bg-white p-4">
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-50 font-bold text-primary">
                    {row.fullName?.charAt(0) || 'A'}
                  </span>
                  <Status ok={row.isVerified} yes="Verified" no="Pending" />
                </div>
                <h3 className="mt-3 font-bold text-slate-900">{row.fullName}</h3>
                <p className="text-xs text-slate-500">
                  {row.program} · {row.branch} · {row.passoutYear}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  {row.currentEmployer
                    ? `${row.currentDesignation || 'Professional'} at ${row.currentEmployer}`
                    : row.higherStudies
                      ? `Higher studies at ${row.higherStudies.institution}`
                      : 'Career outcome awaiting update'}
                </p>
                <button
                  type="button"
                  onClick={() => setDetailId(row._id)}
                  className="mt-auto pt-4 text-left text-xs font-semibold text-primary"
                >
                  Open profile
                </button>
              </div>
            )}
            table={
              <CustomTable
                data={records}
                columns={columns}
                actions={actions}
                isLoading={isLoading}
                isValidating={isValidating}
                title="Alumni directory"
                description="Verified graduate identities, current career outcomes and higher-study pathways."
                onRefresh={() => mutate()}
                page={page}
                totalCount={total}
                pageSize={15}
                onPageChange={setPage}
                options={{ search: false, refresh: true, pagination: true, pageSize: 15 }}
              />
            }
          />
        </>
      )}
      {detailId && <AlumniDrawer id={detailId} onClose={() => setDetailId(null)} />}
      {editing && (
        <CareerModal
          alumni={editing}
          saving={acting}
          onClose={() => setEditing(null)}
          onSaved={async (body) => {
            const response = await mutation(`alumni/${editing._id}`, { method: 'PUT', body });
            if (!response?.results?.success) return;
            toast.success('Career outcome updated and queued for verification');
            await mutate();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface IAnalyticsItem {
  _id: string | number;
  total: number;
  placed?: number;
}

interface IAlumniAnalytics {
  summary: {
    total: number;
    identityVerified: number;
    careerVerified: number;
    employed: number;
    higherStudies: number;
    avgPackage: number;
  };
  graduationTrend: IAnalyticsItem[];
  programs: IAnalyticsItem[];
  employers: IAnalyticsItem[];
  locations: IAnalyticsItem[];
}

function AlumniOverview() {
  const { data, error, isLoading, isValidating, mutate } = useSwr<{ data?: IAlumniAnalytics }>(
    'alumni/stats',
  );
  const analytics = data?.data;
  const summary = analytics?.summary;
  const total = summary?.total ?? 0;
  const outcomeKnown = (summary?.employed ?? 0) + (summary?.higherStudies ?? 0);
  const cards = [
    {
      label: 'Alumni network',
      value: total,
      note: 'Graduate profiles',
      icon: Users,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Identity readiness',
      value: percent(summary?.identityVerified ?? 0, total),
      note: `${summary?.identityVerified ?? 0} verified`,
      icon: ShieldCheck,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Career evidence',
      value: percent(summary?.careerVerified ?? 0, total),
      note: `${summary?.careerVerified ?? 0} verified outcomes`,
      icon: Briefcase,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Average package',
      value: summary?.avgPackage ? compactMoney(summary.avgPackage) : '—',
      note: 'Verified employment records',
      icon: TrendingUp,
      tone: 'bg-amber-50 text-amber-700',
    },
  ];
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
      >
        Alumni analytics could not be loaded. No estimated figures are shown.
      </div>
    );
  return (
    <section className="space-y-4" aria-label="Alumni analytics overview">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Alumni intelligence</h2>
          <p className="text-sm text-slate-500">
            Institution-wide graduation, verification and career outcome signals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary"
        >
          {isValidating ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={`grid h-10 w-10 place-items-center rounded-lg ${tone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-2xl font-black text-slate-950">{isLoading ? '—' : value}</p>
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{note}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <AnalyticsPanel
          title="Graduate network growth"
          description="Alumni created by pass-out year, with employed outcomes highlighted."
          icon={<GraduationCap className="h-5 w-5 text-primary" />}
        >
          <TrendChart data={analytics?.graduationTrend ?? []} />
        </AnalyticsPanel>
        <AnalyticsPanel
          title="Outcome readiness"
          description="Known pathways compared with records still requiring an update."
          icon={<Activity className="h-5 w-5 text-violet-600" />}
        >
          <OutcomeChart
            employed={summary?.employed ?? 0}
            studies={summary?.higherStudies ?? 0}
            unknown={Math.max(0, total - outcomeKnown)}
          />
        </AnalyticsPanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <RankPanel
          title="Programme representation"
          icon={<GraduationCap />}
          data={analytics?.programs ?? []}
        />
        <RankPanel
          title="Leading employers"
          icon={<Building2 />}
          data={analytics?.employers ?? []}
        />
        <RankPanel title="Alumni locations" icon={<MapPin />} data={analytics?.locations ?? []} />
      </div>
    </section>
  );
}

function AnalyticsPanel({
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

function TrendChart({ data }: { data: IAnalyticsItem[] }) {
  if (!data.length)
    return (
      <EmptyAnalytics text="Graduation trends will appear after alumni profiles are created." />
    );
  const visible = data.slice(-8);
  const max = Math.max(...visible.map((item) => item.total), 1);
  const x = (index: number) => 36 + (index * 568) / Math.max(visible.length - 1, 1);
  const y = (value: number) => 166 - (value / max) * 126;
  const totalPoints = visible.map((item, index) => `${x(index)},${y(item.total)}`).join(' ');
  const placedPoints = visible.map((item, index) => `${x(index)},${y(item.placed ?? 0)}`).join(' ');
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 640 205"
        role="img"
        aria-label="Alumni graduation and employment trend"
        className="h-52 min-w-[560px] w-full"
      >
        <defs>
          <linearGradient id="alumniTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0178d7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0178d7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 82, 124, 166].map((lineY) => (
          <line
            key={lineY}
            x1="36"
            y1={lineY}
            x2="604"
            y2={lineY}
            stroke="#e2e8f0"
            strokeDasharray="4 5"
          />
        ))}
        <polygon points={`36,166 ${totalPoints} 604,166`} fill="url(#alumniTrendFill)" />
        <polyline
          points={totalPoints}
          fill="none"
          stroke="#0178d7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={placedPoints}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {visible.map((item, index) => (
          <g key={String(item._id)}>
            <circle
              cx={x(index)}
              cy={y(item.total)}
              r="4"
              fill="white"
              stroke="#0178d7"
              strokeWidth="2.5"
            >
              <title>{`${item.total} alumni in ${item._id}`}</title>
            </circle>
            <text
              x={x(index)}
              y="191"
              textAnchor="middle"
              fill="#64748b"
              fontSize="11"
              fontWeight="600"
            >
              {item._id}
            </text>
          </g>
        ))}
        <g transform="translate(430 15)" fontSize="10" fill="#64748b">
          <circle r="4" fill="#0178d7" />
          <text x="9" y="4">
            Alumni
          </text>
          <circle cx="70" r="4" fill="#7c3aed" />
          <text x="79" y="4">
            Employed
          </text>
        </g>
      </svg>
    </div>
  );
}

function OutcomeChart({
  employed,
  studies,
  unknown,
}: {
  employed: number;
  studies: number;
  unknown: number;
}) {
  const total = Math.max(employed + studies + unknown, 1);
  const values = [
    { label: 'Employment', value: employed, color: 'bg-primary' },
    { label: 'Higher studies', value: studies, color: 'bg-violet-500' },
    { label: 'Awaiting update', value: unknown, color: 'bg-slate-200' },
  ];
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {values.map((item) => (
          <div
            key={item.label}
            className={item.color}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {values.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <i className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              {item.label}
            </span>
            <strong className="text-slate-900">
              {item.value}{' '}
              <span className="font-normal text-slate-400">· {percent(item.value, total)}</span>
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankPanel({
  title,
  icon,
  data,
}: {
  title: string;
  icon: React.ReactNode;
  data: IAnalyticsItem[];
}) {
  const max = Math.max(...data.map((item) => item.total), 1);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-800">
        <span className="[&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-primary">{icon}</span>
        <h3 className="font-bold">{title}</h3>
      </div>
      {data.length ? (
        <div className="mt-5 space-y-4">
          {data.map((item) => (
            <div key={String(item._id)}>
              <div className="mb-1.5 flex justify-between gap-3 text-xs">
                <span className="truncate font-medium text-slate-600">
                  {item._id || 'Not specified'}
                </span>
                <strong>{item.total}</strong>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(item.total / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyAnalytics text="No verified data available yet." />
      )}
    </article>
  );
}

function EmptyAnalytics({ text }: { text: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
function percent(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : '0%';
}
function compactMoney(value: number) {
  return `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
}

function GraduationWorkspace() {
  const { data, isLoading, isValidating, mutate } = useSwr('alumni/graduation-candidates?limit=50');
  const candidates = (data as { data?: IGraduationCandidate[] })?.data ?? [];
  const { mutation, isLoading: acting } = useMutation();
  const columns: Column<IGraduationCandidate>[] = [
    { field: 'fullName', title: 'Student' },
    { field: 'rollNumber', title: 'Roll number' },
    { field: 'program', title: 'Program' },
    { field: 'batch', title: 'Batch' },
    {
      field: 'eligible',
      title: 'Clearance',
      render: (row) => <Status ok={row.eligible} yes="Eligible" no="Blocked" />,
    },
    {
      field: 'blockers',
      title: 'What remains',
      render: (row) =>
        row.blockers.join(', ') || 'All academic and institutional clearances complete',
    },
  ];
  const actions: Action<IGraduationCandidate>[] = [
    {
      icon: <GraduationCap size={15} />,
      tooltip: 'Complete graduation',
      hidden: (row) => !row.eligible,
      onClick: async (row) => {
        const result = await Swal.fire({
          title: 'Complete graduation?',
          text: `${row.fullName} will become passed-out and receive a verified alumni profile.`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Graduate student',
        });
        if (!result.isConfirmed) return;
        const response = await mutation(`alumni/students/${row.studentProfileId}/graduate`, {
          method: 'POST',
        });
        if (!response?.results?.success) return;
        toast.success('Graduation completed and alumni profile created');
        mutate();
      },
    },
  ];
  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
        Eligibility is calculated from published semester results, earned credits, fees, library,
        hostel and transport clearances. It cannot be manually overridden here.
      </div>
      <CustomTable
        data={candidates}
        columns={columns}
        actions={actions}
        isLoading={isLoading || acting}
        isValidating={isValidating}
        title="Graduation clearance"
        description="Students at programme completion, with academic and institutional blockers calculated from source records."
        onRefresh={() => mutate()}
        options={{ search: true, refresh: true, pagination: true }}
      />
    </section>
  );
}

function AlumniDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useSwr<{ data?: IAlumni }>(`alumni/${id}`);
  const alumni = data?.data;
  return (
    <Modal title="Alumni profile" onClose={onClose}>
      {isLoading || !alumni ? (
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <h3 className="text-lg font-black text-slate-900">{alumni.fullName}</h3>
            <p className="text-sm text-slate-500">
              {alumni.email} · {alumni.phone || 'No phone'}
            </p>
            <p className="mt-2 text-sm">
              {alumni.program} · {alumni.branch} · Class of {alumni.passoutYear}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Identity" value={alumni.isVerified ? 'Verified' : 'Pending'} />
            <Info
              label="Career evidence"
              value={alumni.careerOutcomeVerified ? 'Verified' : 'Pending'}
            />
            <Info label="Employer" value={alumni.currentEmployer || '—'} />
            <Info label="Designation" value={alumni.currentDesignation || '—'} />
            <Info label="Location" value={alumni.currentLocation || '—'} />
            <Info
              label="Package"
              value={alumni.package ? `₹${alumni.package.toLocaleString('en-IN')}` : '—'}
            />
          </div>
          {alumni.skills?.length > 0 && (
            <p className="text-sm text-slate-600">Skills: {alumni.skills.join(', ')}</p>
          )}
          {alumni.linkedinUrl && (
            <a
              href={alumni.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-primary"
            >
              Open LinkedIn profile
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}

function CareerModal({
  alumni,
  saving,
  onClose,
  onSaved,
}: {
  alumni: IAlumni;
  saving: boolean;
  onClose: () => void;
  onSaved: (body: Record<string, unknown>) => void;
}) {
  const [path, setPath] = useState(
    alumni.isPlaced ? 'employment' : alumni.higherStudies ? 'studies' : 'employment',
  );
  const [employer, setEmployer] = useState(alumni.currentEmployer ?? '');
  const [designation, setDesignation] = useState(alumni.currentDesignation ?? '');
  const [location, setLocation] = useState(alumni.currentLocation ?? '');
  const [packageValue, setPackageValue] = useState(alumni.package?.toString() ?? '');
  const [linkedin, setLinkedin] = useState(alumni.linkedinUrl ?? '');
  const [skills, setSkills] = useState(alumni.skills?.join(', ') ?? '');
  const [institution, setInstitution] = useState(alumni.higherStudies?.institution ?? '');
  const [program, setProgram] = useState(alumni.higherStudies?.program ?? '');
  const [year, setYear] = useState(alumni.higherStudies?.year?.toString() ?? '');
  return (
    <Modal title={`Update outcome · ${alumni.fullName}`} onClose={onClose}>
      <div className="grid gap-4">
        <select
          value={path}
          onChange={(event) => setPath(event.target.value)}
          className={fieldClass}
        >
          <option value="employment">Employment / entrepreneurship</option>
          <option value="studies">Higher studies</option>
        </select>
        {path === 'employment' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              placeholder="Employer / venture *"
              className={fieldClass}
            />
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Designation"
              className={fieldClass}
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Current location"
              className={fieldClass}
            />
            <input
              type="number"
              min="0"
              value={packageValue}
              onChange={(e) => setPackageValue(e.target.value)}
              placeholder="Annual package"
              className={fieldClass}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Institution *"
              className={fieldClass}
            />
            <input
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="Programme *"
              className={fieldClass}
            />
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Joining year *"
              className={fieldClass}
            />
          </div>
        )}
        <input
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="LinkedIn profile (optional)"
          className={fieldClass}
        />
        <input
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Skills, separated by commas"
          className={fieldClass}
        />
        <div className="flex justify-end gap-2">
          <CustomButton variant="cancel" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton
            loading={saving}
            onClick={() => {
              if (path === 'employment' && !employer.trim())
                return toast.error('Employer or venture is required');
              if (path === 'studies' && (!institution.trim() || !program.trim() || !year))
                return toast.error('Complete higher-study details');
              onSaved({
                isPlaced: path === 'employment',
                currentEmployer: path === 'employment' ? employer.trim() : undefined,
                currentDesignation: path === 'employment' ? designation.trim() : undefined,
                currentLocation: location.trim() || undefined,
                package: path === 'employment' && packageValue ? Number(packageValue) : undefined,
                higherStudies:
                  path === 'studies'
                    ? {
                        institution: institution.trim(),
                        program: program.trim(),
                        year: Number(year),
                      }
                    : undefined,
                linkedinUrl: linkedin.trim() || undefined,
                skills: skills
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              });
            }}
          >
            Save for verification
          </CustomButton>
        </div>
      </div>
    </Modal>
  );
}

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
    >
      {ok ? yes : no}
    </span>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] uppercase text-slate-600">{label}</p>
      <p className="mt-1 text-slate-800">{value}</p>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-black text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

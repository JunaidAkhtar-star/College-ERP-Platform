'use client';

import CustomButton from '@/shared/core/CustomButton';
import StudentSupportWorkflowBar from '@/shared/components/StudentSupportWorkflowBar';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { ClipboardPlus, Eye, Gavel, Plus, Scale, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';

type TSeverity = 'minor' | 'moderate' | 'major' | 'critical';
type TStatus =
  | 'reported'
  | 'triage'
  | 'investigation'
  | 'hearing'
  | 'decided'
  | 'appealed'
  | 'closed'
  | 'dismissed';
interface ICategory {
  _id: string;
  name: string;
  code: string;
  defaultSeverity: TSeverity;
}
interface IPerson {
  _id: string;
  name: string;
  email: string;
  roles: string[];
  studentId?: string;
  employeeId?: string;
}
interface IIncident extends Record<string, unknown> {
  _id: string;
  incidentNumber: string;
  title: string;
  description: string;
  categoryId: ICategory;
  severity: TSeverity;
  occurredAt: string;
  location?: string;
  accusedUserIds: IPerson[];
  witnessUserIds: IPerson[];
  evidence: IFile[];
  status: TStatus;
  reportedBy: string;
  assignedTo?: IPerson;
  finding?: string;
  decision?: string;
  createdAt: string;
}
interface IEvent {
  _id: string;
  type: string;
  content: string;
  fromStatus?: string;
  toStatus?: string;
  eventAt: string;
  createdByName: string;
}
interface ISanction {
  _id: string;
  userId: IPerson;
  type: string;
  description: string;
  startsAt: string;
  endsAt?: string;
  amount?: number;
  status: string;
}
interface IDetail {
  incident: IIncident;
  events: IEvent[];
  sanctions: ISanction[];
}
interface IMetadata {
  categories: ICategory[];
  severities: TSeverity[];
  statuses: TStatus[];
  sanctionTypes: string[];
}
interface IFile {
  url: string;
  name: string;
  publicId?: string;
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}

const inputClass =
  'w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';
const nextStatuses: Record<TStatus, TStatus[]> = {
  reported: ['triage', 'dismissed'],
  triage: ['investigation', 'hearing', 'dismissed'],
  investigation: ['hearing', 'decided', 'dismissed'],
  hearing: ['decided', 'dismissed'],
  decided: ['closed'],
  appealed: ['hearing', 'decided', 'closed'],
  closed: [],
  dismissed: [],
};

export default function DisciplinePage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const manager = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'hod',
    'administration_office',
  ].includes(activeRole);
  const {
    data: metadataRaw,
    error: metadataError,
    mutate: refreshMetadata,
  } = useSwr<IApiResponse<IMetadata>>('discipline/metadata');
  const {
    data: incidentsRaw,
    error: incidentsError,
    isLoading: incidentsLoading,
    mutate: refreshIncidents,
  } = useSwr<IApiResponse<IIncident[]>>('discipline');
  const { mutation, isLoading } = useMutation();
  const metadata = metadataRaw?.data;
  const incidents = useMemo(() => incidentsRaw?.data ?? [], [incidentsRaw]);
  const [reportOpen, setReportOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const {
    data: detailRaw,
    error: detailError,
    mutate: refreshDetail,
  } = useSwr<IApiResponse<IDetail>>(detailId ? `discipline/${detailId}` : null);
  const detail = detailRaw?.data;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [location, setLocation] = useState('');
  const [accused, setAccused] = useState<IPerson[]>([]);
  const [witnesses, setWitnesses] = useState<IPerson[]>([]);
  const [evidence, setEvidence] = useState<IFile[]>([]);
  const [personQuery, setPersonQuery] = useState('');
  const { data: peopleRaw } = useSwr<IApiResponse<IPerson[]>>(
    personQuery.trim().length >= 2
      ? `discipline/people?q=${encodeURIComponent(personQuery)}`
      : null,
  );
  const people = peopleRaw?.data ?? [];
  const [transitionStatus, setTransitionStatus] = useState<TStatus | ''>('');
  const [transitionNote, setTransitionNote] = useState('');
  const [finding, setFinding] = useState('');
  const [decision, setDecision] = useState('');
  const [eventContent, setEventContent] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categorySeverity, setCategorySeverity] = useState<TSeverity>('moderate');
  const [sanctionOpen, setSanctionOpen] = useState(false);
  const [sanctionUserId, setSanctionUserId] = useState('');
  const [sanctionType, setSanctionType] = useState('warning');
  const [sanctionDescription, setSanctionDescription] = useState('');
  const [sanctionStart, setSanctionStart] = useState('');
  const resetReport = () => {
    setTitle('');
    setDescription('');
    setCategoryId('');
    setOccurredAt('');
    setLocation('');
    setAccused([]);
    setWitnesses([]);
    setEvidence([]);
    setPersonQuery('');
  };
  const uploadEvidence = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: formData,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as
      | { url?: string; filename?: string; publicId?: string }
      | undefined;
    if (!uploaded?.url) return false;
    setEvidence((current) => [
      ...current,
      {
        url: uploaded.url as string,
        name: uploaded.filename ?? file.name,
        publicId: uploaded.publicId,
      },
    ]);
    return true;
  };
  const report = async () => {
    if (!categoryId || !occurredAt || accused.length === 0) {
      toast.error('Category, incident date and involved person are required');
      return;
    }
    const response = await mutation('discipline', {
      method: 'POST',
      body: {
        title,
        description,
        categoryId,
        occurredAt,
        location,
        accusedUserIds: accused.map((person) => person._id),
        witnessUserIds: witnesses.map((person) => person._id),
        evidence,
      },
    });
    if (!response?.results?.success) return;
    toast.success('Incident securely registered');
    await refreshIncidents();
    setReportOpen(false);
    resetReport();
  };
  const createCategory = async () => {
    const response = await mutation('discipline/categories', {
      method: 'POST',
      body: { name: categoryName, code: categoryCode, defaultSeverity: categorySeverity },
    });
    if (!response?.results?.success) return;
    toast.success('Category created');
    await refreshMetadata();
    setCategoryOpen(false);
  };
  const transition = async () => {
    if (!detailId || !transitionStatus || transitionNote.trim().length < 3) return;
    const response = await mutation(`discipline/${detailId}/transition`, {
      method: 'POST',
      body: {
        status: transitionStatus,
        note: transitionNote,
        finding: finding || undefined,
        decision: decision || undefined,
      },
    });
    if (!response?.results?.success) return;
    toast.success('Case status updated');
    await Promise.all([refreshDetail(), refreshIncidents()]);
    setTransitionStatus('');
    setTransitionNote('');
  };
  const addNote = async () => {
    if (!detailId || eventContent.trim().length < 3) return;
    const response = await mutation(`discipline/${detailId}/events`, {
      method: 'POST',
      body: { type: 'note', content: eventContent, private: true },
    });
    if (!response?.results?.success) return;
    toast.success('Private case note added');
    await refreshDetail();
    setEventContent('');
  };
  const appeal = async () => {
    if (!detailId || appealReason.trim().length < 10) return;
    const response = await mutation(`discipline/${detailId}/appeal`, {
      method: 'POST',
      body: { reason: appealReason },
    });
    if (!response?.results?.success) return;
    toast.success('Appeal submitted');
    await Promise.all([refreshDetail(), refreshIncidents()]);
    setAppealReason('');
  };
  const sanction = async () => {
    if (!detailId || !sanctionUserId || !sanctionStart) return;
    const response = await mutation(`discipline/${detailId}/sanctions`, {
      method: 'POST',
      body: {
        userId: sanctionUserId,
        type: sanctionType,
        description: sanctionDescription,
        startsAt: sanctionStart,
      },
    });
    if (!response?.results?.success) return;
    toast.success('Sanction recorded');
    await refreshDetail();
    setSanctionOpen(false);
  };
  const columns: Column<IIncident>[] = [
    { field: 'incidentNumber', title: 'Case #' },
    { field: 'title', title: 'Incident' },
    { field: 'categoryId', title: 'Category', render: (row) => row.categoryId?.name ?? '—' },
    { field: 'severity', title: 'Severity', render: (row) => <Severity value={row.severity} /> },
    { field: 'status', title: 'Status', render: (row) => <Status value={row.status} /> },
    {
      field: 'occurredAt',
      title: 'Occurred',
      render: (row) => new Date(row.occurredAt).toLocaleDateString('en-IN'),
    },
  ];
  const actions: Action<IIncident>[] = [
    { icon: <Eye size={15} />, tooltip: 'Open case', onClick: (row) => setDetailId(row._id) },
  ];
  return (
    <div className="space-y-6 p-2 mb-10">
      <StudentSupportWorkflowBar />
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Scale className="h-4 w-4" />{' '}
            {activeRole === 'student'
              ? 'Campus Code of Conduct'
              : 'Fair and auditable case management'}
          </p>
          <h1 className="text-3xl font-black text-slate-950">
            {activeRole === 'student' ? 'Student Conduct & Cases' : 'Discipline Management'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeRole === 'student'
              ? 'Confidential incident reporting, case tracking, hearings, and institutional code of conduct.'
              : 'Confidential reporting, hearings, decisions, sanctions and appeals.'}
          </p>
        </div>
        <div className="flex gap-2">
          {manager && (
            <CustomButton
              variant="secondary"
              onClick={() => setCategoryOpen(true)}
              startIcon={<Plus className="h-4 w-4" />}
            >
              Category
            </CustomButton>
          )}
          <CustomButton
            variant="primary"
            onClick={() => setReportOpen(true)}
            startIcon={<ClipboardPlus className="h-4 w-4" />}
          >
            Report incident
          </CustomButton>
        </div>
      </header>
      {(metadataError || incidentsError || detailError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Discipline records could not be loaded. Refresh and try again; confidential data is never
          replaced with placeholders.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric
          label="Open cases"
          value={incidents.filter((row) => !['closed', 'dismissed'].includes(row.status)).length}
        />
        <Metric
          label="Under investigation"
          value={incidents.filter((row) => row.status === 'investigation').length}
        />
        <Metric
          label="Hearings"
          value={incidents.filter((row) => row.status === 'hearing').length}
        />
        <Metric
          label="Appeals"
          value={incidents.filter((row) => row.status === 'appealed').length}
        />
      </div>
      <section>
        <CustomTable<IIncident>
          columns={columns}
          data={incidents}
          actions={actions}
          isLoading={incidentsLoading}
        />
      </section>
      {reportOpen && (
        <Modal title="Report discipline incident" onClose={() => setReportOpen(false)}>
          <div className="grid gap-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Incident title"
              className={inputClass}
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder="Factual description"
              className={inputClass}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className={inputClass}
              >
                <option value="">Select category</option>
                {metadata?.categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                className={inputClass}
              />
            </div>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location (optional)"
              className={inputClass}
            />
            <PersonPicker
              query={personQuery}
              setQuery={setPersonQuery}
              results={people}
              accused={accused}
              witnesses={witnesses}
              setAccused={setAccused}
              setWitnesses={setWitnesses}
            />
            <InlineFileUpload
              label="Evidence"
              multiple
              files={evidence}
              onUpload={uploadEvidence}
              onRemove={async (_file, index) =>
                setEvidence((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
            />
            <div className="flex justify-end">
              <CustomButton variant="primary" onClick={report} loading={isLoading}>
                Register incident
              </CustomButton>
            </div>
          </div>
        </Modal>
      )}
      {categoryOpen && (
        <Modal title="New discipline category" onClose={() => setCategoryOpen(false)}>
          <div className="grid gap-3">
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Category name"
              className={inputClass}
            />
            <input
              value={categoryCode}
              onChange={(event) => setCategoryCode(event.target.value.toUpperCase())}
              placeholder="Code"
              className={inputClass}
            />
            <select
              value={categorySeverity}
              onChange={(event) => setCategorySeverity(event.target.value as TSeverity)}
              className={inputClass}
            >
              {metadata?.severities.map((severity) => (
                <option key={severity}>{severity}</option>
              ))}
            </select>
            <CustomButton variant="primary" onClick={createCategory}>
              Create category
            </CustomButton>
          </div>
        </Modal>
      )}
      {detailId && detail && (
        <Modal
          title={`${detail.incident.incidentNumber} · ${detail.incident.title}`}
          onClose={() => setDetailId(null)}
          wide
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <main className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2">
                  <Severity value={detail.incident.severity} />
                  <Status value={detail.incident.status} />
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {detail.incident.description}
                </p>
                <p className="mt-3 text-xs text-slate-600">
                  Occurred {new Date(detail.incident.occurredAt).toLocaleString('en-IN')}{' '}
                  {detail.incident.location ? `· ${detail.incident.location}` : ''}
                </p>
              </div>
              <section>
                <h3 className="mb-3 font-black text-slate-900">Case timeline</h3>
                <div className="space-y-2">
                  {detail.events.map((event) => (
                    <div key={event._id} className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex justify-between gap-3">
                        <span className="text-xs font-bold uppercase text-primary">
                          {event.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-600">
                          {new Date(event.eventAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{event.content}</p>
                      <p className="mt-1 text-xs text-slate-600">{event.createdByName}</p>
                    </div>
                  ))}
                </div>
              </section>
              {detail.sanctions.length > 0 && (
                <section>
                  <h3 className="mb-2 font-black text-slate-900">Sanctions</h3>
                  {detail.sanctions.map((row) => (
                    <div key={row._id} className="mb-2 rounded-2xl bg-red-50 p-3 text-sm">
                      <strong className="capitalize text-red-700">
                        {row.type.replace('_', ' ')}
                      </strong>
                      <p className="mt-1 text-red-600">{row.description}</p>
                    </div>
                  ))}
                </section>
              )}
            </main>
            <aside className="space-y-4">
              {manager && nextStatuses[detail.incident.status].length > 0 && (
                <section className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-black text-slate-900">Advance case</h3>
                  <select
                    value={transitionStatus}
                    onChange={(event) => setTransitionStatus(event.target.value as TStatus)}
                    className={`${inputClass} mt-3`}
                  >
                    <option value="">Next status</option>
                    {nextStatuses[detail.incident.status].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  {transitionStatus === 'decided' && (
                    <>
                      <textarea
                        value={finding}
                        onChange={(event) => setFinding(event.target.value)}
                        rows={3}
                        placeholder="Finding"
                        className={`${inputClass} mt-2`}
                      />
                      <textarea
                        value={decision}
                        onChange={(event) => setDecision(event.target.value)}
                        rows={3}
                        placeholder="Written decision"
                        className={`${inputClass} mt-2`}
                      />
                    </>
                  )}
                  <textarea
                    value={transitionNote}
                    onChange={(event) => setTransitionNote(event.target.value)}
                    rows={3}
                    placeholder="Transition note"
                    className={`${inputClass} mt-2`}
                  />
                  <CustomButton
                    variant="primary"
                    onClick={transition}
                    loading={isLoading}
                    className="mt-2"
                  >
                    Update status
                  </CustomButton>
                </section>
              )}
              {manager && (
                <section className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-black text-slate-900">Private case note</h3>
                  <textarea
                    value={eventContent}
                    onChange={(event) => setEventContent(event.target.value)}
                    rows={3}
                    className={`${inputClass} mt-2`}
                  />
                  <CustomButton variant="secondary" onClick={addNote} className="mt-2">
                    Add note
                  </CustomButton>
                </section>
              )}
              {manager && ['decided', 'appealed', 'closed'].includes(detail.incident.status) && (
                <CustomButton
                  variant="secondary"
                  onClick={() => setSanctionOpen(true)}
                  startIcon={<Gavel className="h-4 w-4" />}
                >
                  Record sanction
                </CustomButton>
              )}
              {!manager && detail.incident.status === 'decided' && (
                <section className="rounded-2xl bg-amber-50 p-4">
                  <h3 className="font-black text-amber-900">Submit appeal</h3>
                  <textarea
                    value={appealReason}
                    onChange={(event) => setAppealReason(event.target.value)}
                    rows={4}
                    className={`${inputClass} mt-2`}
                  />
                  <CustomButton variant="primary" onClick={appeal} className="mt-2">
                    Appeal decision
                  </CustomButton>
                </section>
              )}
            </aside>
          </div>
        </Modal>
      )}
      {sanctionOpen && detail && (
        <Modal title="Record sanction" onClose={() => setSanctionOpen(false)}>
          <div className="grid gap-3">
            <select
              value={sanctionUserId}
              onChange={(event) => setSanctionUserId(event.target.value)}
              className={inputClass}
            >
              <option value="">Select involved person</option>
              {detail.incident.accusedUserIds.map((person) => (
                <option key={person._id} value={person._id}>
                  {person.name}
                </option>
              ))}
            </select>
            <select
              value={sanctionType}
              onChange={(event) => setSanctionType(event.target.value)}
              className={inputClass}
            >
              {metadata?.sanctionTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <textarea
              value={sanctionDescription}
              onChange={(event) => setSanctionDescription(event.target.value)}
              rows={4}
              placeholder="Sanction details"
              className={inputClass}
            />
            <input
              type="date"
              value={sanctionStart}
              onChange={(event) => setSanctionStart(event.target.value)}
              className={inputClass}
            />
            <CustomButton variant="primary" onClick={sanction}>
              Record sanction
            </CustomButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PersonPicker({
  query,
  setQuery,
  results,
  accused,
  witnesses,
  setAccused,
  setWitnesses,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: IPerson[];
  accused: IPerson[];
  witnesses: IPerson[];
  setAccused: (value: IPerson[]) => void;
  setWitnesses: (value: IPerson[]) => void;
}) {
  return (
    <div>
      <label className="relative block">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people by name or email"
          className={`${inputClass} pl-9`}
        />
      </label>
      {results.length > 0 && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl bg-slate-50 p-2">
          {results.map((person) => (
            <div
              key={person._id}
              className="flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-white"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{person.name}</p>
                <p className="text-xs text-slate-600">{person.email}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    !accused.some((row) => row._id === person._id) &&
                    setAccused([...accused, person])
                  }
                  className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600"
                >
                  Involved
                </button>
                <button
                  onClick={() =>
                    !witnesses.some((row) => row._id === person._id) &&
                    setWitnesses([...witnesses, person])
                  }
                  className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600"
                >
                  Witness
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {accused.map((person) => (
          <button
            key={person._id}
            onClick={() => setAccused(accused.filter((row) => row._id !== person._id))}
            className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600"
          >
            Involved: {person.name} ×
          </button>
        ))}
        {witnesses.map((person) => (
          <button
            key={person._id}
            onClick={() => setWitnesses(witnesses.filter((row) => row._id !== person._id))}
            className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-600"
          >
            Witness: {person.name} ×
          </button>
        ))}
      </div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
function Severity({ value }: { value: TSeverity }) {
  const color =
    value === 'critical'
      ? 'bg-red-50 text-red-700'
      : value === 'major'
        ? 'bg-orange-50 text-orange-700'
        : value === 'moderate'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-blue-50 text-blue-700';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${color}`}>
      {value}
    </span>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${['closed', 'decided'].includes(value) ? 'bg-emerald-50 text-emerald-700' : value === 'dismissed' ? 'bg-slate-100 text-slate-600' : 'bg-violet-50 text-violet-700'}`}
    >
      {value}
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[94dvh] w-full overflow-y-auto rounded-3xl bg-white p-6 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

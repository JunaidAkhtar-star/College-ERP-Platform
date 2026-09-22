'use client';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Action, type Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import {
  Activity,
  ClipboardCheck,
  Clock3,
  Headphones,
  ListTree,
  Plus,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import type { ITenant } from '../types/super-admin.types';
interface IApi<T> {
  success: boolean;
  data: T;
}
interface IOwner {
  _id: string;
  name: string;
  email: string;
}
interface IMilestone {
  _id: string;
  name: string;
  category: string;
  dueAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  note?: string;
}
interface IProject extends Record<string, unknown> {
  _id: string;
  tenantId: string | Pick<ITenant, '_id' | 'tenantId' | 'name' | 'status'>;
  ownerId: string | IOwner;
  stage: string;
  health: string;
  targetGoLiveAt: string;
  milestones: IMilestone[];
  risks: Array<{
    _id: string;
    summary: string;
    severity: 'low' | 'medium' | 'high';
    mitigation: string;
    ownerId: string | IOwner;
    status: 'open' | 'mitigated';
  }>;
}
interface ITicket extends Record<string, unknown> {
  _id: string;
  number: string;
  tenantId: string | Pick<ITenant, '_id' | 'tenantId' | 'name'>;
  category: string;
  priority: string;
  subject: string;
  status: string;
  requesterName: string;
  requesterEmail: string;
  ownerId?: string | IOwner;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  resolution?: string;
  comments: Array<{ _id: string; body: string; visibility: string; createdAt: string }>;
}
interface IDashboard {
  activeImplementations: number;
  atRiskImplementations: number;
  openTickets: number;
  breachedResponse: number;
  breachedResolution: number;
  criticalTickets: number;
}
type TModal =
  | 'project'
  | 'milestone'
  | 'projectStage'
  | 'risk'
  | 'ticket'
  | 'transition'
  | 'comment'
  | null;
const field =
  'mt-1 w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';
const display = (value: string | { name: string }) =>
  typeof value === 'string' ? 'Linked record' : value.name;
export default function CustomerOperationsPage() {
  const [tab, setTab] = useState<'overview' | 'projects' | 'tickets'>('overview'),
    [modal, setModal] = useState<TModal>(null),
    [project, setProject] = useState<IProject | null>(null),
    [ticket, setTicket] = useState<ITicket | null>(null);
  const { mutation, isLoading } = useMutation();
  const { data: dashboard } = useSwr<IApi<IDashboard>>('platform-customer-operations/dashboard'),
    { data: projectsRaw, mutate: refreshProjects } = useSwr<IApi<IProject[]>>(
      'platform-customer-operations/projects',
    ),
    { data: ticketsRaw, mutate: refreshTickets } = useSwr<IApi<ITicket[]>>(
      'platform-customer-operations/tickets',
    ),
    { data: ownersRaw } = useSwr<IApi<IOwner[]>>('platform-customer-operations/owners'),
    { data: tenantsRaw } = useSwr<{ data?: ITenant[] }>('super-admin/tenants');
  const projects = projectsRaw?.data ?? [],
    tickets = ticketsRaw?.data ?? [],
    owners = ownersRaw?.data ?? [],
    tenants = tenantsRaw?.data ?? [],
    d = dashboard?.data;
  const save = async (
    path: string,
    body: object,
    message: string,
    refresh: () => Promise<unknown>,
    method: 'POST' | 'PATCH' = 'POST',
  ) => {
    const response = await mutation(path, { method, body });
    if (!response?.results?.success) return;
    toast.success(message);
    setModal(null);
    setProject(null);
    setTicket(null);
    await refresh();
  };
  const projectColumns: Column<IProject>[] = [
      { field: 'tenantId', title: 'Tenant', render: (r) => display(r.tenantId) },
      { field: 'stage', title: 'Stage', render: (r) => <Badge value={r.stage} /> },
      { field: 'health', title: 'Health', render: (r) => <Badge value={r.health} /> },
      { field: 'ownerId', title: 'Implementation owner', render: (r) => display(r.ownerId) },
      {
        field: 'milestones',
        title: 'Progress',
        render: (r) =>
          `${r.milestones.filter((m) => m.status === 'completed').length}/${r.milestones.length}`,
      },
      {
        field: 'risks',
        title: 'Open risks',
        render: (r) => r.risks.filter((risk) => risk.status === 'open').length,
      },
      {
        field: 'targetGoLiveAt',
        title: 'Target go-live',
        render: (r) => new Date(r.targetGoLiveAt).toLocaleDateString('en-IN'),
      },
    ],
    projectActions: Action<IProject>[] = [
      {
        tooltip: 'Update milestone',
        icon: <ClipboardCheck className="h-4 w-4" />,
        hidden: (r) => r.stage === 'completed',
        onClick: (r) => {
          setProject(r);
          setModal('milestone');
        },
      },
      {
        tooltip: 'Advance implementation stage',
        icon: <ListTree className="h-4 w-4" />,
        hidden: (r) => r.stage === 'completed',
        onClick: (r) => {
          setProject(r);
          setModal('projectStage');
        },
      },
      {
        tooltip: 'Record or mitigate risk',
        icon: <ShieldAlert className="h-4 w-4" />,
        hidden: (r) => r.stage === 'completed',
        onClick: (r) => {
          setProject(r);
          setModal('risk');
        },
      },
    ];
  const ticketColumns: Column<ITicket>[] = [
      {
        field: 'number',
        title: 'Ticket',
        render: (r) => (
          <div>
            <p className="font-semibold">
              {r.number} · {r.subject}
            </p>
            <p className="text-xs text-slate-400">{display(r.tenantId)}</p>
          </div>
        ),
      },
      { field: 'priority', title: 'Priority', render: (r) => <Badge value={r.priority} /> },
      { field: 'status', title: 'Status', render: (r) => <Badge value={r.status} /> },
      {
        field: 'ownerId',
        title: 'Owner',
        render: (r) => (r.ownerId ? display(r.ownerId) : 'Unassigned'),
      },
      {
        field: 'firstResponseDueAt',
        title: 'Response SLA',
        render: (r) => <Due value={r.firstResponseDueAt} done={r.status !== 'open'} />,
      },
      {
        field: 'resolutionDueAt',
        title: 'Resolution SLA',
        render: (r) => (
          <Due value={r.resolutionDueAt} done={['resolved', 'closed'].includes(r.status)} />
        ),
      },
      { field: 'comments', title: 'Updates', render: (r) => r.comments.length },
    ],
    ticketActions: Action<ITicket>[] = [
      {
        tooltip: 'Advance ticket',
        icon: <RefreshCw className="h-4 w-4" />,
        hidden: (r) => r.status === 'closed',
        onClick: (r) => {
          setTicket(r);
          setModal('transition');
        },
      },
      {
        tooltip: 'Add communication',
        icon: <Headphones className="h-4 w-4" />,
        hidden: (r) => r.status === 'closed',
        onClick: (r) => {
          setTicket(r);
          setModal('comment');
        },
      },
    ];
  const cards: Array<[React.ElementType, string, number]> = [
    [Activity, 'Active implementations', d?.activeImplementations ?? 0],
    [TriangleAlert, 'Implementations at risk', d?.atRiskImplementations ?? 0],
    [Headphones, 'Open support tickets', d?.openTickets ?? 0],
    [Clock3, 'Resolution SLA breaches', d?.breachedResolution ?? 0],
  ];
  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Customer success
          </p>
          <h1 className="text-2xl font-black text-slate-950">
            Implementation & Support Operations
          </h1>
          <p className="text-sm text-slate-500">
            Guide every tenant to go-live and resolve production issues against visible service
            commitments.
          </p>
        </div>
        {tab !== 'overview' && (
          <CustomButton onClick={() => setModal(tab === 'projects' ? 'project' : 'ticket')}>
            <Plus className="mr-2 h-4 w-4" />
            Add {tab === 'projects' ? 'implementation' : 'support ticket'}
          </CustomButton>
        )}
      </header>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1">
        {[
          ['overview', 'Overview'],
          ['projects', 'Implementations'],
          ['tickets', 'Support desk'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-primary text-white' : 'text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([Icon, label, value]) => (
            <article key={label} className="rounded-2xl bg-white p-5">
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-black">{value}</p>
            </article>
          ))}
        </div>
      )}
      {tab === 'projects' && (
        <CustomTable
          title="Tenant implementation portfolio"
          data={projects}
          columns={projectColumns}
          actions={projectActions}
          options={{ responsive: true, export: true, bordered: false }}
        />
      )}
      {tab === 'tickets' && (
        <CustomTable
          title="Support SLA worklist"
          data={tickets}
          columns={ticketColumns}
          actions={ticketActions}
          options={{ responsive: true, export: true, bordered: false }}
        />
      )}
      {modal === 'project' && (
        <ProjectForm
          tenants={tenants.filter(
            (t) =>
              !projects.some(
                (p) => (typeof p.tenantId === 'string' ? p.tenantId : p.tenantId._id) === t._id,
              ),
          )}
          owners={owners}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) =>
            save(
              'platform-customer-operations/projects',
              v,
              'Implementation project created',
              refreshProjects,
            )
          }
        />
      )}{' '}
      {modal === 'milestone' && project && (
        <MilestoneForm
          project={project}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(id, v) =>
            save(
              `platform-customer-operations/projects/${project._id}/milestones/${id}`,
              v,
              'Milestone updated',
              refreshProjects,
              'PATCH',
            )
          }
        />
      )}{' '}
      {modal === 'projectStage' && project && (
        <ProjectStageForm
          project={project}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) =>
            save(
              `platform-customer-operations/projects/${project._id}/stage`,
              v,
              'Implementation stage updated',
              refreshProjects,
              'PATCH',
            )
          }
        />
      )}{' '}
      {modal === 'risk' && project && (
        <RiskForm
          project={project}
          owners={owners}
          loading={isLoading}
          close={() => setModal(null)}
          add={(v) =>
            save(
              `platform-customer-operations/projects/${project._id}/risks`,
              v,
              'Implementation risk recorded',
              refreshProjects,
            )
          }
          mitigate={(riskId) =>
            save(
              `platform-customer-operations/projects/${project._id}/risks/${riskId}/mitigate`,
              {},
              'Implementation risk mitigated',
              refreshProjects,
              'PATCH',
            )
          }
        />
      )}{' '}
      {modal === 'ticket' && (
        <TicketForm
          tenants={tenants}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) =>
            save(
              'platform-customer-operations/tickets',
              v,
              'Support ticket created',
              refreshTickets,
            )
          }
        />
      )}{' '}
      {modal === 'transition' && ticket && (
        <TransitionForm
          ticket={ticket}
          owners={owners}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) =>
            save(
              `platform-customer-operations/tickets/${ticket._id}`,
              v,
              'Support ticket updated',
              refreshTickets,
              'PATCH',
            )
          }
        />
      )}{' '}
      {modal === 'comment' && ticket && (
        <CommentForm
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) =>
            save(
              `platform-customer-operations/tickets/${ticket._id}/comments`,
              v,
              'Support communication added',
              refreshTickets,
            )
          }
        />
      )}
    </div>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
      {value.replaceAll('_', ' ')}
    </span>
  );
}
function Due({ value, done }: { value: string; done: boolean }) {
  const late = !done && new Date(value) < new Date();
  return (
    <span className={late ? 'font-semibold text-red-600' : ''}>
      {new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4">
      <div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-4 flex justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={close}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ErrorText({ name }: { name: string }) {
  return (
    <ErrorMessage name={name}>
      {(message) => <p className="text-xs text-red-500">{message}</p>}
    </ErrorMessage>
  );
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
function ProjectForm({
  tenants,
  owners,
  loading,
  close,
  submit,
}: {
  tenants: ITenant[];
  owners: IOwner[];
  loading: boolean;
  close: () => void;
  submit: (values: object) => Promise<void>;
}) {
  return (
    <Shell title="Start tenant implementation" close={close}>
      <Formik
        initialValues={{
          tenantId: '',
          ownerId: '',
          stage: 'discovery',
          targetGoLiveAt: '',
          milestones: [
            { name: 'Discovery sign-off', category: 'discovery', dueAt: '' },
            { name: 'Data migration validation', category: 'migration', dueAt: '' },
            { name: 'Administrator training', category: 'training', dueAt: '' },
            { name: 'Go-live readiness review', category: 'go_live', dueAt: '' },
          ],
        }}
        validationSchema={Yup.object({
          tenantId: Yup.string().required(),
          ownerId: Yup.string().required(),
          targetGoLiveAt: Yup.date().min(new Date()).required(),
          milestones: Yup.array()
            .of(
              Yup.object({
                name: Yup.string().required(),
                category: Yup.string().required(),
                dueAt: Yup.date().required(),
              }),
            )
            .min(1),
        })}
        onSubmit={submit}
      >
        {({ values }) => (
          <Form className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Tenant *
                <Field as="select" name="tenantId" className={field}>
                  <option value="">Select tenant</option>
                  {tenants.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.tenantId} · {t.name}
                    </option>
                  ))}
                </Field>
              </label>
              <label className="text-sm">
                Implementation owner *
                <Field as="select" name="ownerId" className={field}>
                  <option value="">Select owner</option>
                  {owners.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.name} · {o.email}
                    </option>
                  ))}
                </Field>
              </label>
              <label className="text-sm">
                Target go-live *<Field type="date" name="targetGoLiveAt" className={field} />
                <ErrorText name="targetGoLiveAt" />
              </label>
            </div>
            <FieldArray name="milestones">
              {({ push, remove }) => (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <b>Implementation milestones</b>
                    <button
                      type="button"
                      onClick={() => push({ name: '', category: 'configuration', dueAt: '' })}
                      className="text-xs font-semibold text-primary"
                    >
                      Add milestone
                    </button>
                  </div>
                  {values.milestones.map((_, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3"
                    >
                      <Field
                        name={`milestones.${index}.name`}
                        placeholder="Milestone"
                        className={field}
                      />
                      <Field
                        name={`milestones.${index}.category`}
                        placeholder="Category"
                        className={field}
                      />
                      <div className="flex gap-2">
                        <Field type="date" name={`milestones.${index}.dueAt`} className={field} />
                        <button
                          type="button"
                          disabled={values.milestones.length === 1}
                          onClick={() => remove(index)}
                          className="text-xs text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FieldArray>
            <div className="flex justify-end">
              <CustomButton type="submit" loading={loading}>
                Start implementation
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function MilestoneForm({
  project,
  loading,
  close,
  submit,
}: {
  project: IProject;
  loading: boolean;
  close: () => void;
  submit: (id: string, values: object) => Promise<void>;
}) {
  return (
    <Shell title="Update implementation milestone" close={close}>
      <Formik
        initialValues={{ milestoneId: '', status: 'in_progress', note: '' }}
        validationSchema={Yup.object({
          milestoneId: Yup.string().required(),
          status: Yup.string().required(),
          note: Yup.string().max(2000),
        })}
        onSubmit={(v) => submit(v.milestoneId, { status: v.status, note: v.note })}
      >
        {() => (
          <Form className="space-y-3">
            <label className="block text-sm">
              Milestone *
              <Field as="select" name="milestoneId" className={field}>
                <option value="">Select milestone</option>
                {project.milestones.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} · {m.status}
                  </option>
                ))}
              </Field>
            </label>
            <label className="block text-sm">
              Status
              <Field as="select" name="status" className={field}>
                {['pending', 'in_progress', 'completed', 'blocked'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Field>
            </label>
            <label className="block text-sm">
              Evidence or blocker note
              <Field as="textarea" name="note" className={field} />
            </label>
            <div className="flex justify-end">
              <CustomButton type="submit" loading={loading}>
                Update milestone
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function ProjectStageForm({
  project,
  loading,
  close,
  submit,
}: {
  project: IProject;
  loading: boolean;
  close: () => void;
  submit: (values: object) => Promise<void>;
}) {
  const stages = [
      'discovery',
      'configuration',
      'migration',
      'training',
      'go_live',
      'stabilization',
      'completed',
    ],
    currentIndex = stages.indexOf(project.stage),
    options =
      project.stage === 'on_hold'
        ? ['discovery', 'configuration']
        : [stages[currentIndex + 1], 'on_hold'].filter(Boolean);
  return (
    <Shell title="Advance implementation stage" close={close}>
      <p className="mb-3 text-sm text-slate-500">
        Current stage: <Badge value={project.stage} />. Stages advance in sequence so readiness
        evidence cannot be skipped.
      </p>
      <Formik
        initialValues={{ stage: options[0] ?? '' }}
        validationSchema={Yup.object({ stage: Yup.string().required('Select the next stage') })}
        onSubmit={submit}
      >
        {() => (
          <Form className="space-y-3">
            <label className="block text-sm">
              Next stage *
              <Field as="select" name="stage" className={field}>
                {options.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll('_', ' ')}
                  </option>
                ))}
              </Field>
            </label>
            <div className="flex justify-end">
              <CustomButton type="submit" loading={loading}>
                Update stage
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function RiskForm({
  project,
  owners,
  loading,
  close,
  add,
  mitigate,
}: {
  project: IProject;
  owners: IOwner[];
  loading: boolean;
  close: () => void;
  add: (values: object) => Promise<void>;
  mitigate: (riskId: string) => Promise<void>;
}) {
  const openRisks = project.risks.filter((risk) => risk.status === 'open');
  return (
    <Shell title="Implementation risks" close={close}>
      {openRisks.length > 0 && (
        <div className="mb-5 space-y-2">
          <h3 className="text-sm font-bold">Open risks</h3>
          {openRisks.map((risk) => (
            <article key={risk._id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <p className="font-semibold">{risk.summary}</p>
                  <p className="text-xs text-slate-500">Mitigation: {risk.mitigation}</p>
                </div>
                <CustomButton loading={loading} onClick={() => mitigate(risk._id)}>
                  Mark mitigated
                </CustomButton>
              </div>
            </article>
          ))}
        </div>
      )}
      <Formik
        initialValues={{ summary: '', severity: 'medium', mitigation: '', ownerId: '' }}
        validationSchema={Yup.object({
          summary: Yup.string().min(5).required(),
          severity: Yup.string().oneOf(['low', 'medium', 'high']).required(),
          mitigation: Yup.string().min(5).required(),
          ownerId: Yup.string().required('Select a risk owner'),
        })}
        onSubmit={add}
      >
        {() => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              Risk summary *<Field name="summary" className={field} />
              <ErrorText name="summary" />
            </label>
            <label className="text-sm">
              Severity *
              <Field as="select" name="severity" className={field}>
                {['low', 'medium', 'high'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Risk owner *
              <Field as="select" name="ownerId" className={field}>
                <option value="">Select owner</option>
                {owners.map((owner) => (
                  <option key={owner._id} value={owner._id}>
                    {owner.name}
                  </option>
                ))}
              </Field>
              <ErrorText name="ownerId" />
            </label>
            <label className="text-sm sm:col-span-2">
              Mitigation plan *<Field as="textarea" name="mitigation" className={field} />
              <ErrorText name="mitigation" />
            </label>
            <Submit loading={loading} label="Record risk" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function TicketForm({
  tenants,
  loading,
  close,
  submit,
}: {
  tenants: ITenant[];
  loading: boolean;
  close: () => void;
  submit: (values: object) => Promise<void>;
}) {
  return (
    <Shell title="Create support ticket" close={close}>
      <Formik
        initialValues={{
          tenantId: '',
          category: 'incident',
          priority: 'medium',
          subject: '',
          description: '',
          requesterName: '',
          requesterEmail: '',
        }}
        validationSchema={Yup.object({
          tenantId: Yup.string().required(),
          category: Yup.string().required(),
          priority: Yup.string().required(),
          subject: Yup.string().min(3).required(),
          description: Yup.string().min(10).required(),
          requesterName: Yup.string().required(),
          requesterEmail: Yup.string().email().required(),
        })}
        onSubmit={submit}
      >
        {() => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Tenant *
              <Field as="select" name="tenantId" className={field}>
                <option value="">Select tenant</option>
                {tenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.tenantId} · {t.name}
                  </option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Priority
              <Field as="select" name="priority" className={field}>
                {['low', 'medium', 'high', 'critical'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Category
              <Field as="select" name="category" className={field}>
                {[
                  'incident',
                  'question',
                  'configuration',
                  'data',
                  'billing',
                  'security',
                  'feature_request',
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Subject *<Field name="subject" className={field} />
            </label>
            <label className="text-sm">
              Requester name *<Field name="requesterName" className={field} />
            </label>
            <label className="text-sm">
              Requester email *<Field name="requesterEmail" className={field} />
              <ErrorText name="requesterEmail" />
            </label>
            <label className="text-sm sm:col-span-2">
              Description *<Field as="textarea" rows={4} name="description" className={field} />
            </label>
            <Submit loading={loading} label="Create ticket" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function TransitionForm({
  ticket,
  owners,
  loading,
  close,
  submit,
}: {
  ticket: ITicket;
  owners: IOwner[];
  loading: boolean;
  close: () => void;
  submit: (values: object) => Promise<void>;
}) {
  const options: Record<string, string[]> = {
    open: ['triaged'],
    triaged: ['in_progress', 'waiting_customer'],
    in_progress: ['waiting_customer', 'resolved'],
    waiting_customer: ['in_progress', 'resolved'],
    resolved: ['closed', 'in_progress'],
  };
  return (
    <Shell title={`Advance ${ticket.number}`} close={close}>
      <Formik
        initialValues={{
          status: options[ticket.status]?.[0] ?? '',
          ownerId:
            typeof ticket.ownerId === 'string' ? ticket.ownerId : (ticket.ownerId?._id ?? ''),
          resolution: '',
        }}
        validationSchema={Yup.object({
          status: Yup.string().required(),
          ownerId: Yup.string().when('status', {
            is: (value: string) => ['triaged', 'in_progress'].includes(value),
            then: (schema) => schema.required('Assign an owner'),
          }),
          resolution: Yup.string().when('status', {
            is: 'resolved',
            then: (schema) => schema.min(10).required(),
          }),
        })}
        onSubmit={submit}
      >
        {({ values }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Next status
              <Field as="select" name="status" className={field}>
                {(options[ticket.status] ?? []).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Support owner
              <Field as="select" name="ownerId" className={field}>
                <option value="">Select owner</option>
                {owners.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </Field>
            </label>
            {values.status === 'resolved' && (
              <label className="text-sm sm:col-span-2">
                Resolution evidence *<Field as="textarea" name="resolution" className={field} />
                <ErrorText name="resolution" />
              </label>
            )}
            <Submit loading={loading} label="Advance ticket" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function CommentForm({
  loading,
  close,
  submit,
}: {
  loading: boolean;
  close: () => void;
  submit: (values: object) => Promise<void>;
}) {
  return (
    <Shell title="Add support communication" close={close}>
      <Formik
        initialValues={{ body: '', visibility: 'internal' }}
        validationSchema={Yup.object({
          body: Yup.string().min(2).required(),
          visibility: Yup.string().required(),
        })}
        onSubmit={submit}
      >
        {() => (
          <Form className="space-y-3">
            <label className="block text-sm">
              Visibility
              <Field as="select" name="visibility" className={field}>
                <option value="internal">Internal note</option>
                <option value="customer">Customer-visible update</option>
              </Field>
            </label>
            <label className="block text-sm">
              Message *<Field as="textarea" rows={4} name="body" className={field} />
            </label>
            <div className="flex justify-end">
              <CustomButton type="submit" loading={loading}>
                Add communication
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

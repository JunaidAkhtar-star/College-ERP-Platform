'use client';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Action, type Column } from '@/shared/core/CustomTable';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import {
  AlertTriangle,
  ClipboardCheck,
  LayoutDashboard,
  LibraryBig,
  Plus,
  ShieldCheck,
  Siren,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import AiGovernanceInsights from './AiGovernanceInsights';
interface Api<T> {
  success: boolean;
  data: T;
}
interface UseCase extends Record<string, unknown> {
  _id: string;
  name: string;
  purpose: string;
  ownerId: string | { name: string };
  provider: string;
  modelName: string;
  decisionImpact: string;
  riskLevel: string;
  humanReviewRequired: boolean;
  status: string;
  reviewDueAt?: string;
  approvedBy?: string | { name: string };
  approvedAt?: string;
}
interface Assessment extends Record<string, unknown> {
  _id: string;
  useCaseId: string | UseCase;
  version: number;
  residualRisk: string;
  mitigations: string[];
  assessedAt: string;
  assessedBy: string | { name: string };
  privacyRisk: number;
  biasRisk: number;
  securityRisk: number;
  explainabilityRisk: number;
  impactRisk: number;
}
interface Incident extends Record<string, unknown> {
  _id: string;
  number: string;
  useCaseId: string | UseCase;
  severity: string;
  summary: string;
  status: string;
  ownerId: string | { name: string };
  createdAt: string;
  description: string;
  resolution?: string;
  containedAt?: string;
  resolvedAt?: string;
}
interface Dash {
  registered: number;
  approved: number;
  highRisk: number;
  openIncidents: number;
  overdueReviews: number;
  statusDistribution?: Record<string, number>;
  riskDistribution?: Record<string, number>;
  incidentSeverity?: Record<string, number>;
}
type Modal = 'usecase' | 'assessment' | 'decision' | 'incident' | 'transition' | null;
const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10';
const name = (v: string | { name: string }) => (typeof v === 'string' ? 'Linked record' : v.name);
export default function AiGovernancePage() {
  const [tab, setTab] = useState<'overview' | 'registry' | 'assessments' | 'incidents'>('overview'),
    [modal, setModal] = useState<Modal>(null),
    [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null),
    [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const { mutation, isLoading } = useMutation();
  const canCreate = useHasPermission('compliance', 'create'),
    canEdit = useHasPermission('compliance', 'edit'),
    canApprove = useHasPermission('compliance', 'approve');
  const {
      data: dash,
      mutate: rd,
      isValidating: refreshingDashboard,
    } = useSwr<Api<Dash>>('ai-governance/dashboard'),
    {
      data: ur,
      mutate: ru,
      isValidating: refreshingUseCases,
    } = useSwr<Api<UseCase[]>>('ai-governance/use-cases'),
    {
      data: ar,
      mutate: ra,
      isValidating: refreshingAssessments,
    } = useSwr<Api<Assessment[]>>('ai-governance/assessments'),
    {
      data: ir,
      mutate: ri,
      isValidating: refreshingIncidents,
    } = useSwr<Api<Incident[]>>('ai-governance/incidents');
  const useCases = ur?.data ?? [],
    assessments = ar?.data ?? [],
    incidents = ir?.data ?? [],
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
    setSelectedUseCase(null);
    setSelectedIncident(null);
    await Promise.all([refresh(), rd(), ru(), ra(), ri()]);
  };
  const ucols: Column<UseCase>[] = [
      {
        field: 'name',
        title: 'AI use case',
        render: (r) => (
          <div>
            <b>{r.name}</b>
            <p className="text-xs text-slate-600">
              {r.provider} · {r.modelName}
            </p>
          </div>
        ),
      },
      { field: 'ownerId', title: 'Accountable owner', render: (r) => name(r.ownerId) },
      { field: 'decisionImpact', title: 'Impact', render: (r) => <Badge v={r.decisionImpact} /> },
      { field: 'riskLevel', title: 'Risk', render: (r) => <Badge v={r.riskLevel} /> },
      {
        field: 'humanReviewRequired',
        title: 'Human review',
        render: (r) => (r.humanReviewRequired ? 'Required' : 'Not required'),
      },
      { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    ],
    uactions: Action<UseCase>[] = [
      {
        tooltip: 'Record governance decision',
        icon: <ShieldCheck className="h-4 w-4" />,
        hidden: (r) => !canApprove || r.status !== 'under_review',
        onClick: (r) => {
          setSelectedUseCase(r);
          setModal('decision');
        },
      },
    ];
  const acols: Column<Assessment>[] = [
    { field: 'useCaseId', title: 'Use case', render: (r) => name(r.useCaseId) },
    { field: 'version', title: 'Version', render: (r) => `v${r.version}` },
    { field: 'residualRisk', title: 'Residual risk', render: (r) => <Badge v={r.residualRisk} /> },
    { field: 'mitigations', title: 'Mitigations', render: (r) => r.mitigations.length },
    { field: 'assessedBy', title: 'Assessor', render: (r) => name(r.assessedBy) },
    {
      field: 'assessedAt',
      title: 'Assessed',
      render: (r) => new Date(r.assessedAt).toLocaleDateString('en-IN'),
    },
  ];
  const icols: Column<Incident>[] = [
      {
        field: 'number',
        title: 'Incident',
        render: (r) => (
          <div>
            <b>{r.number}</b>
            <p className="text-xs">{r.summary}</p>
          </div>
        ),
      },
      { field: 'useCaseId', title: 'Use case', render: (r) => name(r.useCaseId) },
      { field: 'severity', title: 'Severity', render: (r) => <Badge v={r.severity} /> },
      { field: 'ownerId', title: 'Owner', render: (r) => name(r.ownerId) },
      { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    ],
    iactions: Action<Incident>[] = [
      {
        tooltip: 'Advance incident response',
        icon: <AlertTriangle className="h-4 w-4" />,
        hidden: (r) => !canEdit || r.status === 'resolved',
        onClick: (r) => {
          setSelectedIncident(r);
          setModal('transition');
        },
      },
    ];
  const open = () =>
    setModal(tab === 'registry' ? 'usecase' : tab === 'assessments' ? 'assessment' : 'incident');
  const tabs = [
    { key: 'overview', label: 'Overview', description: 'Live posture', icon: LayoutDashboard },
    {
      key: 'registry',
      label: 'AI registry',
      description: `${useCases.length} systems`,
      icon: LibraryBig,
    },
    {
      key: 'assessments',
      label: 'Risk reviews',
      description: `${assessments.length} assessments`,
      icon: ClipboardCheck,
    },
    {
      key: 'incidents',
      label: 'Incidents',
      description: `${incidents.length} reported`,
      icon: Siren,
    },
  ] as const;
  return (
    <div className="space-y-5 ">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Trust & accountability
          </p>
          <h1 className="text-2xl font-black">Responsible AI Governance</h1>
          <p className="text-sm text-slate-500">
            Register every AI use, assess privacy and bias, require human oversight, and manage
            incidents transparently.
          </p>
        </div>
        {canCreate && tab !== 'assessments' && (
          <CustomButton onClick={open}>
            <Plus className="mr-2 h-4 w-4" />
            Add {tab === 'overview' ? 'incident' : tab === 'registry' ? 'use case' : 'incident'}
          </CustomButton>
        )}
        {canEdit && tab === 'assessments' && (
          <CustomButton onClick={open}>
            <Plus className="mr-2 h-4 w-4" />
            Record assessment
          </CustomButton>
        )}
      </header>
      <nav
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="AI governance sections"
      >
        {tabs.map(({ key, label, description, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            onClick={() => setTab(key)}
            aria-selected={tab === key}
            aria-controls={`ai-governance-${key}-panel`}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              tab === key ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                tab === key ? 'bg-white/15' : 'bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs font-bold">{label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${tab === key ? 'text-white/75' : 'text-slate-400'}`}
              >
                {description}
              </span>
            </span>
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <div id="ai-governance-overview-panel" role="tabpanel">
          <AiGovernanceInsights data={d} />
        </div>
      )}
      {tab === 'registry' && (
        <div id="ai-governance-registry-panel" role="tabpanel">
          <CustomTable
            title="Institutional AI use-case register"
            subtitle="AI systems, owners and lifecycle decisions"
            description="Maintain one accountable inventory of institutional AI usage, risk classification and human-oversight requirements."
            data={useCases}
            columns={ucols}
            actions={uactions}
            detailPanel={(row) => <UseCaseDetails item={row} />}
            onRefresh={() => void Promise.all([ru(), rd()])}
            isRefreshing={refreshingUseCases || refreshingDashboard}
            options={{
              responsive: true,
              export: true,
              refresh: true,
              bordered: false,
              detailPanel: true,
            }}
          />
        </div>
      )}
      {tab === 'assessments' && (
        <div id="ai-governance-assessments-panel" role="tabpanel">
          <CustomTable
            title="Versioned AI risk assessments"
            subtitle="Privacy, fairness, security and impact assurance"
            description="Review scored risk dimensions, mitigation commitments and residual exposure for every active AI system."
            data={assessments}
            columns={acols}
            detailPanel={(row) => <AssessmentDetails item={row} />}
            onRefresh={() => void Promise.all([ra(), ru(), rd()])}
            isRefreshing={refreshingAssessments || refreshingUseCases}
            options={{
              responsive: true,
              export: true,
              refresh: true,
              bordered: false,
              detailPanel: true,
            }}
          />
        </div>
      )}
      {tab === 'incidents' && (
        <div id="ai-governance-incidents-panel" role="tabpanel">
          <CustomTable
            title="AI incident response"
            subtitle="Operational safety and accountable resolution"
            description="Track reported failures, affected AI systems, response ownership, containment and resolution evidence."
            data={incidents}
            columns={icols}
            actions={iactions}
            detailPanel={(row) => <IncidentDetails item={row} />}
            onRefresh={() => void Promise.all([ri(), ru(), rd()])}
            isRefreshing={refreshingIncidents || refreshingUseCases}
            options={{
              responsive: true,
              export: true,
              refresh: true,
              bordered: false,
              detailPanel: true,
            }}
          />
        </div>
      )}
      {modal === 'usecase' && (
        <UseCaseForm
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) => save('ai-governance/use-cases', v, 'AI use case registered', ru)}
        />
      )}{' '}
      {modal === 'assessment' && (
        <AssessmentForm
          useCases={useCases}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) => save('ai-governance/assessments', v, 'Risk assessment recorded', ra)}
        />
      )}{' '}
      {modal === 'decision' && selectedUseCase && (
        <DecisionForm
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) =>
            save(
              `ai-governance/use-cases/${selectedUseCase._id}/decision`,
              v,
              'Governance decision recorded',
              ru,
            )
          }
        />
      )}{' '}
      {modal === 'incident' && (
        <IncidentForm
          useCases={useCases}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) => save('ai-governance/incidents', v, 'AI incident reported', ri)}
        />
      )}{' '}
      {modal === 'transition' && selectedIncident && (
        <TransitionForm
          item={selectedIncident}
          loading={isLoading}
          close={() => setModal(null)}
          submit={(v) =>
            save(
              `ai-governance/incidents/${selectedIncident._id}`,
              v,
              'Incident response updated',
              ri,
              'PATCH',
            )
          }
        />
      )}
    </div>
  );
}
function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-800">{value || 'Not recorded'}</div>
    </div>
  );
}
function UseCaseDetails({ item }: { item: UseCase }) {
  return (
    <DetailGrid>
      <Detail label="Purpose" value={item.purpose} />
      <Detail label="Provider and model" value={`${item.provider} · ${item.modelName}`} />
      <Detail
        label="Human oversight"
        value={item.humanReviewRequired ? 'Required' : 'Not required'}
      />
      <Detail
        label="Next review"
        value={
          item.reviewDueAt ? new Date(item.reviewDueAt).toLocaleDateString('en-IN') : undefined
        }
      />
      <Detail label="Decision owner" value={item.approvedBy ? name(item.approvedBy) : undefined} />
      <Detail
        label="Decision date"
        value={item.approvedAt ? new Date(item.approvedAt).toLocaleDateString('en-IN') : undefined}
      />
    </DetailGrid>
  );
}
function AssessmentDetails({ item }: { item: Assessment }) {
  return (
    <DetailGrid>
      {[
        ['Privacy', item.privacyRisk],
        ['Bias and fairness', item.biasRisk],
        ['Security', item.securityRisk],
        ['Explainability', item.explainabilityRisk],
        ['Human impact', item.impactRisk],
      ].map(([risk, score]) => (
        <Detail key={String(risk)} label={`${risk} risk`} value={`${score}/5`} />
      ))}
      <Detail
        label="Mitigations"
        value={
          <ul className="list-disc space-y-1 pl-4">
            {item.mitigations.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        }
      />
    </DetailGrid>
  );
}
function IncidentDetails({ item }: { item: Incident }) {
  return (
    <DetailGrid>
      <Detail label="Description" value={item.description} />
      <Detail label="Reported" value={new Date(item.createdAt).toLocaleString('en-IN')} />
      <Detail
        label="Contained"
        value={item.containedAt ? new Date(item.containedAt).toLocaleString('en-IN') : undefined}
      />
      <Detail
        label="Resolved"
        value={item.resolvedAt ? new Date(item.resolvedAt).toLocaleString('en-IN') : undefined}
      />
      <Detail label="Resolution evidence" value={item.resolution} />
    </DetailGrid>
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
  const descriptions: Record<string, string> = {
    'Register AI use case':
      'Document the system before institutional use. Clear ownership, purpose and data classification help reviewers apply the right safeguards.',
    'Record AI risk assessment':
      'Score the system using current evidence. A new submission creates a versioned assessment and moves the use case into governance review.',
    'Record governance decision':
      'Confirm that risks and mitigations are acceptable. Approval requires an independent reviewer and a future reassessment date.',
    'Report AI incident':
      'Record suspected harm, failure, misuse or data exposure promptly. Critical reports automatically suspend the affected AI system.',
  };
  const description =
    descriptions[title] ??
    'Record the next response step and preserve clear evidence for the governance audit trail.';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 sm:items-center sm:p-4">
      <div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] leading-4 text-slate-500">{children}</p>;
}
function Section({ title, description }: { title: string; description: string }) {
  return (
    <div className="sm:col-span-2">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
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
function UseCaseForm({
  loading,
  close,
  submit,
}: {
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Register AI use case" close={close}>
      <Formik
        initialValues={{
          name: '',
          purpose: '',
          ownerId: '',
          provider: '',
          modelName: '',
          dataCategories: [] as string[],
          decisionImpact: 'assistive',
          humanReviewRequired: true,
        }}
        validationSchema={Yup.object({
          name: Yup.string()
            .min(2, 'Enter at least 2 characters')
            .required('Use-case name is required'),
          purpose: Yup.string()
            .min(10, 'Explain the purpose in at least 10 characters')
            .required('Purpose is required'),
          ownerId: Yup.string().required('Accountable owner is required'),
          provider: Yup.string().required('Provider is required'),
          modelName: Yup.string().required('Model name or version is required'),
          dataCategories: Yup.array().min(1, 'Select at least one data category'),
          decisionImpact: Yup.string().required('Decision impact is required'),
          humanReviewRequired: Yup.boolean().when('decisionImpact', {
            is: 'high_impact',
            then: (s) => s.oneOf([true], 'High-impact use requires human review'),
          }),
        })}
        onSubmit={submit}
      >
        {({ values, setFieldValue }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <Section
              title="System identity"
              description="Identify the AI service and the person accountable for its safe institutional use."
            />
            <label className="text-sm">
              Use-case name *
              <Field name="name" placeholder="Example: Student support chatbot" className={field} />
              <Hint>Use a clear business name rather than only the vendor name.</Hint>
              <Err n="name" />
            </label>
            <AsyncSelect
              type="users"
              label="Accountable owner"
              required
              value={values.ownerId}
              onChange={(v) => setFieldValue('ownerId', v ?? '')}
            />
            <label className="text-sm">
              Provider *
              <Field
                name="provider"
                placeholder="Example: Microsoft, OpenAI or internal"
                className={field}
              />
              <Hint>The organisation supplying or operating the AI service.</Hint>
              <Err n="provider" />
            </label>
            <label className="text-sm">
              Model name/version *
              <Field
                name="modelName"
                placeholder="Example: GPT-5.4 or internal-v2"
                className={field}
              />
              <Hint>Include the deployed version when it is known.</Hint>
              <Err n="modelName" />
            </label>
            <Section
              title="Purpose and human impact"
              description="Explain how the system influences people and where a human must remain responsible."
            />
            <label className="text-sm">
              Decision impact
              <Field as="select" name="decisionImpact" className={field}>
                {['assistive', 'recommendation', 'high_impact'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Field>
              <Hint>
                Assistive drafts content; recommendation influences a choice; high impact affects
                rights or important outcomes.
              </Hint>
            </label>
            <label className="flex items-center gap-2 self-end p-3 text-sm">
              <Field type="checkbox" name="humanReviewRequired" />
              Human review required
              <span className="text-xs text-slate-500">
                A person verifies output before action.
              </span>
            </label>
            <label className="text-sm sm:col-span-2">
              Purpose *
              <Field
                as="textarea"
                rows={3}
                name="purpose"
                placeholder="Describe the problem, intended users, output and how the output will be used."
                className={field}
              />
              <Err n="purpose" />
            </label>
            <div className="sm:col-span-2">
              <p className="text-sm">Data categories *</p>
              <Hint>Select every category the AI can receive, retrieve, infer or generate.</Hint>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  'public',
                  'institutional',
                  'student_records',
                  'financial',
                  'health',
                  'biometric',
                  'behavioral',
                ].map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() =>
                      setFieldValue(
                        'dataCategories',
                        values.dataCategories.includes(v)
                          ? values.dataCategories.filter((x) => x !== v)
                          : [...values.dataCategories, v],
                      )
                    }
                    className={`rounded-xl px-3 py-2 text-xs ${values.dataCategories.includes(v) ? 'bg-primary text-white' : 'bg-slate-100'}`}
                  >
                    {v.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
              <Err n="dataCategories" />
            </div>
            <Submit loading={loading} label="Register use case" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function AssessmentForm({
  useCases,
  loading,
  close,
  submit,
}: {
  useCases: UseCase[];
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Record AI risk assessment" close={close}>
      <Formik
        initialValues={{
          useCaseId: '',
          privacyRisk: 1,
          biasRisk: 1,
          securityRisk: 1,
          explainabilityRisk: 1,
          impactRisk: 1,
          mitigations: [''],
        }}
        validationSchema={Yup.object({
          useCaseId: Yup.string().required('Select an AI use case'),
          privacyRisk: Yup.number().min(1).max(5).required(),
          biasRisk: Yup.number().min(1).max(5).required(),
          securityRisk: Yup.number().min(1).max(5).required(),
          explainabilityRisk: Yup.number().min(1).max(5).required(),
          impactRisk: Yup.number().min(1).max(5).required(),
          mitigations: Yup.array()
            .of(
              Yup.string()
                .min(3, 'Describe a meaningful control')
                .required('Mitigation is required'),
            )
            .min(1),
        })}
        onSubmit={submit}
      >
        {({ values }) => (
          <Form className="space-y-3">
            <Section
              title="Assessment scope"
              description="Choose the active system being evaluated. Suspended and retired systems cannot receive a new assessment."
            />
            <label className="block text-sm">
              Use case *
              <Field as="select" name="useCaseId" className={field}>
                <option value="">Select use case</option>
                {useCases
                  .filter((x) => !['retired', 'suspended'].includes(x.status))
                  .map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.name}
                    </option>
                  ))}
              </Field>
              <Err n="useCaseId" />
            </label>
            <div className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
              <b>Scoring guide:</b> 1 = negligible, 2 = limited, 3 = meaningful, 4 = serious, 5 =
              severe. Score the remaining exposure after existing controls.
            </div>
            <div className="grid gap-3 sm:grid-cols-5">
              {['privacyRisk', 'biasRisk', 'securityRisk', 'explainabilityRisk', 'impactRisk'].map(
                (k) => (
                  <label key={k} className="text-xs capitalize">
                    {k.replace('Risk', '')} (1–5)
                    <Field type="number" name={k} min="1" max="5" className={field} />
                    <Err n={k} />
                  </label>
                ),
              )}
            </div>
            <FieldArray name="mitigations">
              {({ push, remove }) => (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <b>Mitigations *</b>
                    <button type="button" onClick={() => push('')} className="text-xs text-primary">
                      Add mitigation
                    </button>
                  </div>
                  <Hint>
                    Record specific safeguards, responsible practices or technical controls—not
                    general intentions.
                  </Hint>
                  {values.mitigations.map((_, i) => (
                    <div key={i}>
                      <div className="flex gap-2">
                        <Field
                          name={`mitigations.${i}`}
                          placeholder="Example: Human reviewer confirms every admission recommendation"
                          className={field}
                        />
                        <button
                          type="button"
                          disabled={values.mitigations.length === 1}
                          onClick={() => remove(i)}
                          className="text-xs text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <Err n={`mitigations.${i}`} />
                    </div>
                  ))}
                </div>
              )}
            </FieldArray>
            <div className="flex justify-end">
              <CustomButton type="submit" loading={loading}>
                Submit for review
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function DecisionForm({
  loading,
  close,
  submit,
}: {
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Record governance decision" close={close}>
      <Formik
        initialValues={{ decision: 'approve', reviewDueAt: '' }}
        validationSchema={Yup.object({
          decision: Yup.string().required('Select a governance decision'),
          reviewDueAt: Yup.date().when('decision', {
            is: 'approve',
            then: (s) =>
              s
                .min(new Date(), 'Choose a future review date')
                .required('Next review date is required for approval'),
          }),
        })}
        onSubmit={submit}
      >
        {({ values }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <Section
              title="Independent decision"
              description="Confirm the latest assessment and mitigations before authorising continued use."
            />
            <label className="text-sm">
              Decision
              <Field as="select" name="decision" className={field}>
                <option value="approve">Approve with controls</option>
                <option value="suspend">Suspend use</option>
              </Field>
              <Hint>
                Approval permits controlled use. Suspension prevents use until risks are reassessed.
              </Hint>
            </label>
            <label className="text-sm">
              Next review date
              <Field type="date" name="reviewDueAt" className={field} />
              <Err n="reviewDueAt" />
              <Hint>
                {values.decision === 'approve'
                  ? 'Set when this approval must be formally reconsidered.'
                  : 'Not required when suspending the system.'}
              </Hint>
            </label>
            <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 sm:col-span-2">
              Your identity and decision time are retained in the audit record. The creator or
              latest assessor cannot approve their own work.
            </div>
            <Submit loading={loading} label="Record decision" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function IncidentForm({
  useCases,
  loading,
  close,
  submit,
}: {
  useCases: UseCase[];
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Report AI incident" close={close}>
      <Formik
        initialValues={{
          useCaseId: '',
          severity: 'medium',
          summary: '',
          description: '',
          ownerId: '',
        }}
        validationSchema={Yup.object({
          useCaseId: Yup.string().required('Select the affected AI use case'),
          severity: Yup.string().required('Select incident severity'),
          summary: Yup.string().min(3, 'Enter a clear summary').required('Summary is required'),
          description: Yup.string()
            .min(10, 'Provide at least 10 characters of incident detail')
            .required('Incident description is required'),
          ownerId: Yup.string().required('Incident owner is required'),
        })}
        onSubmit={submit}
      >
        {({ values, setFieldValue }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <Section
              title="Affected system and triage"
              description="Identify the AI system, initial severity and accountable response owner."
            />
            <label className="text-sm">
              Use case
              <Field as="select" name="useCaseId" className={field}>
                <option value="">Select</option>
                {useCases
                  .filter((x) => x.status !== 'retired')
                  .map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.name}
                    </option>
                  ))}
              </Field>
              <Err n="useCaseId" />
            </label>
            <label className="text-sm">
              Severity
              <Field as="select" name="severity" className={field}>
                {['low', 'medium', 'high', 'critical'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Field>
              <Hint>
                Critical means severe harm, major data exposure or an immediate safety threat and
                automatically suspends the system.
              </Hint>
            </label>
            <AsyncSelect
              type="users"
              label="Incident owner"
              required
              value={values.ownerId}
              onChange={(v) => setFieldValue('ownerId', v ?? '')}
            />
            <label className="text-sm">
              Summary *
              <Field
                name="summary"
                placeholder="Briefly state the observed failure or harm"
                className={field}
              />
              <Err n="summary" />
            </label>
            <Section
              title="Incident narrative"
              description="Record observable facts, affected people or processes, timing and immediate actions already taken."
            />
            <label className="text-sm sm:col-span-2">
              What happened? *
              <Field
                as="textarea"
                rows={4}
                name="description"
                placeholder="Describe what occurred, when it was detected, impact, scope and any containment already completed."
                className={field}
              />
              <Err n="description" />
            </label>
            <Submit loading={loading} label="Report incident" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function TransitionForm({
  item,
  loading,
  close,
  submit,
}: {
  item: Incident;
  loading: boolean;
  close: () => void;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const options: Record<string, string[]> = {
    open: ['investigating', 'contained'],
    investigating: ['contained'],
    contained: ['resolved'],
  };
  return (
    <Shell title={`Respond to ${item.number}`} close={close}>
      <Formik
        initialValues={{ status: options[item.status]?.[0] ?? '', resolution: '' }}
        validationSchema={Yup.object({
          status: Yup.string().required(),
          resolution: Yup.string().when('status', {
            is: 'resolved',
            then: (s) => s.min(10).required(),
          }),
        })}
        onSubmit={submit}
      >
        {({ values }) => (
          <Form className="space-y-3">
            <label className="block text-sm">
              Next response stage
              <Field as="select" name="status" className={field}>
                {(options[item.status] ?? []).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Field>
              <Hint>
                Investigation establishes cause; containment stops further impact; resolution
                requires verified evidence.
              </Hint>
            </label>
            {values.status === 'resolved' && (
              <label className="block text-sm">
                Resolution evidence *
                <Field
                  as="textarea"
                  rows={4}
                  name="resolution"
                  placeholder="Document root cause, corrective action, validation performed and why recurrence risk is controlled."
                  className={field}
                />
                <Err n="resolution" />
              </label>
            )}
            <div className="flex justify-end">
              <CustomButton type="submit" loading={loading}>
                Update response
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

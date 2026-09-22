'use client';

import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasAnyRole } from '@/shared/hooks/useHasRole';
import {
  Check,
  Bell,
  CircleAlert,
  Clock3,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FilePlus2,
  GripVertical,
  Plus,
  RotateCw,
  Search,
  Send,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';

type TFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'file';
interface IField {
  key: string;
  label: string;
  type: TFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  min?: number;
  max?: number;
  condition?: { fieldKey: string; operator: 'equals' | 'not_equals'; value: string };
}
interface IWorkflow {
  sequence: number;
  name: string;
  approverRoles: string[];
  allowSelfApproval: boolean;
  slaHours?: number;
  escalationRoles?: string[];
}
interface IDefinition {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  version: number;
  status: 'draft' | 'pending_review' | 'published' | 'archived';
  fields: IField[];
  workflow: IWorkflow[];
  submissionRoles: string[];
  updatedAt: string;
}
interface ISubmission extends Record<string, unknown> {
  _id: string;
  formName: string;
  formVersion: number;
  schemaSnapshot: IField[];
  workflowSnapshot: IWorkflow[];
  submittedByName: string;
  submittedBy: string;
  data: Record<string, string | number | boolean | string[]>;
  status: string;
  currentStep: number;
  submittedAt: string;
  stepDueAt?: string;
  lastReminderAt?: string;
  reminderCount?: number;
  decisions?: Array<{
    step: number;
    decision: 'approved' | 'rejected';
    note?: string;
    decidedByName: string;
    decidedAt: string;
  }>;
}
interface IWorkflowDelegation {
  _id: string;
  delegatorId: string | { _id: string; name: string; email?: string };
  delegateId: string | { _id: string; name: string; email?: string };
  role: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
  canRevoke: boolean;
}
interface IMetadata {
  fieldTypes: TFieldType[];
  roles: Array<{ name: string; displayName: string }>;
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}
interface IUploadedFile {
  url: string;
  name: string;
  publicId?: string;
}

const fieldClass =
  'w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';
const blankField = (index: number): IField => ({
  key: `field_${index}`,
  label: `Field ${index}`,
  type: 'text',
  required: false,
});
const FIELD_LABELS: Record<TFieldType, string> = {
  text: 'Short answer',
  textarea: 'Paragraph',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  date: 'Date',
  select: 'Multiple choice',
  checkbox: 'Checkbox',
  file: 'File upload',
};
function updateField(
  setter: React.Dispatch<React.SetStateAction<IField[]>>,
  index: number,
  patch: Partial<IField>,
) {
  setter((current) =>
    current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
  );
}
const toKey = (label: string, fallback: string) =>
  (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || fallback
  ).length < 2
    ? `${(label.toLowerCase().replace(/[^a-z0-9]/g, '') || fallback).slice(0, 40)}_field`
    : label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);

const FORM_TEMPLATES: Array<{
  name: string;
  category: string;
  description: string;
  fields: IField[];
}> = [
  {
    name: 'Leave request',
    category: 'HR',
    description: 'Collect leave dates, reason and supporting evidence.',
    fields: [
      {
        key: 'leave_type',
        label: 'Leave type',
        type: 'select',
        required: true,
        options: ['Casual', 'Medical', 'Duty'],
      },
      { key: 'from_date', label: 'From date', type: 'date', required: true },
      { key: 'to_date', label: 'To date', type: 'date', required: true },
      { key: 'reason', label: 'Reason', type: 'textarea', required: true },
      { key: 'evidence', label: 'Supporting document', type: 'file', required: false },
    ],
  },
  {
    name: 'Student feedback',
    category: 'Academic',
    description: 'Structured feedback with a follow-up question.',
    fields: [
      {
        key: 'experience',
        label: 'Overall experience',
        type: 'select',
        required: true,
        options: ['Excellent', 'Good', 'Needs improvement'],
      },
      { key: 'comments', label: 'Tell us more', type: 'textarea', required: false },
      { key: 'contact_me', label: 'May we contact you?', type: 'checkbox', required: false },
      {
        key: 'email',
        label: 'Contact email',
        type: 'email',
        required: false,
        condition: { fieldKey: 'contact_me', operator: 'equals', value: 'true' },
      },
    ],
  },
  {
    name: 'Approval request',
    category: 'Administration',
    description: 'A reusable request with amount, justification and evidence.',
    fields: [
      { key: 'request_title', label: 'Request title', type: 'text', required: true },
      { key: 'amount', label: 'Estimated amount', type: 'number', required: false, min: 0 },
      { key: 'justification', label: 'Justification', type: 'textarea', required: true },
      { key: 'attachment', label: 'Supporting evidence', type: 'file', required: false },
    ],
  },
];

export default function FormsWorkflowPage() {
  const manager = useHasAnyRole(['super_admin', 'admin', 'principal', 'administration_office']);
  const {
    data: metadataRaw,
    error: metadataError,
    mutate: refreshMetadata,
  } = useSwr<IApiResponse<IMetadata>>('form-workflow/metadata');
  const {
    data: availableRaw,
    mutate: refreshAvailable,
    isLoading: availableLoading,
    error: availableError,
  } = useSwr<IApiResponse<IDefinition[]>>('form-workflow/definitions');
  const { data: mineRaw, mutate: refreshMine } = useSwr<IApiResponse<ISubmission[]>>(
    'form-workflow/submissions/mine',
  );
  const { data: inboxRaw, mutate: refreshInbox } = useSwr<IApiResponse<ISubmission[]>>(
    'form-workflow/submissions/inbox',
  );
  const { data: manageRaw, mutate: refreshManage } = useSwr<IApiResponse<IDefinition[]>>(
    manager ? 'form-workflow/manage/definitions' : null,
  );
  const { data: responsesRaw } = useSwr<IApiResponse<ISubmission[]>>(
    manager ? 'form-workflow/manage/submissions' : null,
  );
  const { data: delegationsRaw, mutate: refreshDelegations } = useSwr<
    IApiResponse<IWorkflowDelegation[]>
  >('form-workflow/delegations/mine');
  const { mutation, isLoading } = useMutation();
  const metadata = metadataRaw?.data;
  const available = useMemo(() => availableRaw?.data ?? [], [availableRaw]);
  const mine = mineRaw?.data ?? [];
  const inbox = inboxRaw?.data ?? [];
  const managed = manageRaw?.data ?? [];
  const responses = responsesRaw?.data ?? [];
  const delegations = delegationsRaw?.data ?? [];
  const [tab, setTab] = useState<'available' | 'mine' | 'inbox' | 'manage' | 'responses'>(
    'available',
  );
  const [search, setSearch] = useState('');
  const [filling, setFilling] = useState<IDefinition | null>(null);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [files, setFiles] = useState<Record<string, IUploadedFile[]>>({});
  const [deciding, setDeciding] = useState<ISubmission | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [designer, setDesigner] = useState(false);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [formFields, setFormFields] = useState<IField[]>([blankField(1)]);
  const [workflow, setWorkflow] = useState<IWorkflow[]>([]);
  const [submissionRoles, setSubmissionRoles] = useState<string[]>([]);
  const [designerTab, setDesignerTab] = useState<'build' | 'preview' | 'settings'>('build');
  const [draggedField, setDraggedField] = useState<number | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const reorderField = (targetIndex: number) => {
    if (draggedField === null || draggedField === targetIndex) return;
    const next = [...formFields];
    const [moving] = next.splice(draggedField, 1);
    if (!moving) return;
    next.splice(targetIndex, 0, moving);
    const positions = new Map(next.map((field, index) => [field.key, index]));
    const invalid = next.some(
      (field, index) =>
        field.condition &&
        (positions.get(field.condition.fieldKey) === undefined ||
          positions.get(field.condition.fieldKey)! >= index),
    );
    if (invalid) {
      toast.error('A conditional question must stay below the question it depends on');
      setDraggedField(null);
      return;
    }
    setFormFields(next);
    setDraggedField(null);
  };
  const tabs = useMemo(
    () => [
      { key: 'available' as const, label: `Available (${available.length})` },
      { key: 'mine' as const, label: `My submissions (${mine.length})` },
      { key: 'inbox' as const, label: `Approval inbox (${inbox.length})` },
      ...(manager ? [{ key: 'manage' as const, label: `Manage (${managed.length})` }] : []),
      ...(manager ? [{ key: 'responses' as const, label: `Responses (${responses.length})` }] : []),
    ],
    [available.length, inbox.length, manager, managed.length, mine.length, responses.length],
  );
  const visibleAvailable = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return available;
    return available.filter((form) =>
      [form.name, form.category, form.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [available, search]);
  const resetDesigner = () => {
    setEditingId(null);
    setName('');
    setSlug('');
    setCategory('General');
    setDescription('');
    setFormFields([blankField(1)]);
    setWorkflow([]);
    setSubmissionRoles([]);
    setDesignerTab('build');
  };
  const applyTemplate = (template: (typeof FORM_TEMPLATES)[number]) => {
    setEditingId(null);
    setName(template.name);
    setSlug(toKey(template.name, 'new-form').replaceAll('_', '-'));
    setCategory(template.category);
    setDescription(template.description);
    setFormFields(template.fields.map((field) => ({ ...field })));
    setWorkflow([]);
    setSubmissionRoles([]);
    setDesignerTab('build');
    setDesigner(true);
  };
  const openEdit = (form: IDefinition) => {
    setEditingId(form._id);
    setName(form.name);
    setSlug(form.slug);
    setCategory(form.category);
    setDescription(form.description ?? '');
    setFormFields(form.fields);
    setWorkflow(form.workflow);
    setSubmissionRoles(form.submissionRoles);
    setDesigner(true);
  };
  const saveDefinition = async () => {
    if (name.trim().length < 2 || slug.trim().length < 2 || category.trim().length < 2) {
      toast.error('Complete the form name, category and publishing address');
      return;
    }
    if (!formFields.length || formFields.some((field) => !field.label.trim())) {
      toast.error('Add at least one clearly named question');
      return;
    }
    const keys = formFields.map((field) => field.key);
    if (new Set(keys).size !== keys.length) {
      toast.error('Every question needs a unique name');
      return;
    }
    if (workflow.some((step) => !step.name.trim() || !step.approverRoles.length)) {
      toast.error('Complete the name and approver role for every workflow step');
      setDesignerTab('settings');
      return;
    }
    const response = await mutation(
      editingId ? `form-workflow/definitions/${editingId}` : 'form-workflow/definitions',
      {
        method: editingId ? 'PUT' : 'POST',
        body: { name, slug, category, description, fields: formFields, workflow, submissionRoles },
      },
    );
    if (!response?.results?.success) return;
    toast.success('Form draft saved');
    await refreshManage();
    setDesigner(false);
    resetDesigner();
  };
  const publish = async (form: IDefinition) => {
    const response = await mutation(`form-workflow/definitions/${form._id}/publish`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    toast.success('Form published');
    await Promise.all([refreshManage(), refreshAvailable()]);
  };
  const submitForReview = async (form: IDefinition) => {
    const response = await mutation(`form-workflow/definitions/${form._id}/review`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    toast.success('Form submitted for independent review');
    await refreshManage();
  };
  const submit = async () => {
    if (!filling) return;
    const visibleFields = filling.fields.filter((field) => {
      if (!field.condition) return true;
      const matches =
        String(values[field.condition.fieldKey] ?? '') === String(field.condition.value);
      return field.condition.operator === 'equals' ? matches : !matches;
    });
    const missing = visibleFields.filter(
      (field) =>
        field.required &&
        (field.type === 'file'
          ? !files[field.key]?.length
          : values[field.key] === undefined || values[field.key] === ''),
    );
    if (missing.length) {
      toast.error(`Complete required questions: ${missing.map((field) => field.label).join(', ')}`);
      return;
    }
    const data = {
      ...values,
      ...Object.fromEntries(Object.entries(files).map(([key, rows]) => [key, rows[0]?.url ?? ''])),
    };
    const response = await mutation(`form-workflow/definitions/${filling._id}/submit`, {
      method: 'POST',
      body: { data },
    });
    if (!response?.results?.success) return;
    toast.success('Form submitted');
    await Promise.all([refreshMine(), refreshInbox()]);
    setFilling(null);
    setValues({});
    setFiles({});
  };
  const uploadFile = async (key: string, file: File) => {
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
    setFiles((current) => ({
      ...current,
      [key]: [
        {
          url: uploaded.url as string,
          name: uploaded.filename ?? file.name,
          publicId: uploaded.publicId,
        },
      ],
    }));
    return true;
  };
  const decide = async (decision: 'approved' | 'rejected') => {
    if (!deciding) return;
    const response = await mutation(`form-workflow/submissions/${deciding._id}/decision`, {
      method: 'POST',
      body: { decision, note: decisionNote },
    });
    if (!response?.results?.success) return;
    toast.success(`Submission ${decision}`);
    await refreshInbox();
    setDeciding(null);
    setDecisionNote('');
  };
  const withdraw = async (submission: ISubmission) => {
    const response = await mutation(`form-workflow/submissions/${submission._id}/withdraw`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    toast.success('Submission withdrawn before review started');
    await refreshMine();
  };
  const remind = async (submission: ISubmission) => {
    const response = await mutation(`form-workflow/submissions/${submission._id}/remind`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    toast.success('Approval reminder sent');
    await Promise.all([refreshMine(), refreshInbox()]);
  };
  const revokeDelegation = async (id: string) => {
    const response = await mutation(`form-workflow/delegations/${id}`, { method: 'DELETE' });
    if (!response?.results?.success) return;
    toast.success('Approval delegation revoked');
    await refreshDelegations();
  };
  const exportResponses = () => {
    const dynamicFields = Array.from(
      new Map(
        responses.flatMap((row) =>
          row.schemaSnapshot.map((field) => [field.key, field.label] as const),
        ),
      ),
    );
    const rows = [
      [
        'Form',
        'Submitted by',
        'Version',
        'Status',
        'Submitted at',
        'Current approval step',
        'SLA due',
        ...dynamicFields.map(([, label]) => label),
      ],
      ...responses.map((row) => [
        row.formName,
        row.submittedByName,
        String(row.formVersion),
        row.status,
        row.submittedAt,
        String(row.currentStep),
        row.stepDueAt ?? '',
        ...dynamicFields.map(([key]) => String(row.data[key] ?? '')),
      ]),
    ];
    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `form-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const submissionColumns: Column<ISubmission>[] = [
    { field: 'formName', title: 'Form' },
    { field: 'submittedByName', title: 'Submitted by' },
    { field: 'formVersion', title: 'Version', render: (row) => `v${row.formVersion}` },
    { field: 'status', title: 'Status', render: (row) => <Status value={row.status} /> },
    {
      field: 'submittedAt',
      title: 'Submitted',
      render: (row) => new Date(row.submittedAt).toLocaleString('en-IN'),
    },
    {
      field: 'stepDueAt',
      title: 'SLA',
      render: (row) => {
        if (row.status !== 'in_review' || !row.stepDueAt) return '—';
        const overdue = new Date(row.stepDueAt).getTime() < Date.now();
        return (
          <span className={overdue ? 'font-semibold text-rose-600' : 'text-slate-600'}>
            {overdue ? 'Overdue · ' : 'Due · '}
            {new Date(row.stepDueAt).toLocaleString('en-IN')}
          </span>
        );
      },
    },
  ];
  const inboxActions: Action<ISubmission>[] = [
    { icon: <ClipboardCheck size={15} />, tooltip: 'Review', onClick: setDeciding },
  ];
  const mineActions: Action<ISubmission>[] = [
    {
      icon: <Bell size={15} />,
      tooltip: 'Remind current approvers',
      onClick: remind,
      hidden: (row) => row.status !== 'in_review',
    },
    {
      icon: <X size={15} />,
      tooltip: 'Withdraw before review',
      onClick: withdraw,
      hidden: (row) =>
        !['submitted', 'in_review'].includes(row.status) || Boolean(row.decisions?.length),
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <ClipboardCheck className="h-4 w-4" /> No-code operations
          </p>
          <h1 className="text-3xl font-black text-slate-950">Forms & Workflows</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dynamic forms with versioned schemas and multi-step approvals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomButton variant="secondary" onClick={() => setDelegationOpen(true)}>
            Approval delegation
          </CustomButton>
          {manager && (
            <CustomButton
              variant="primary"
              onClick={() => {
                resetDesigner();
                setDesigner(true);
              }}
              startIcon={<FilePlus2 className="h-4 w-4" />}
            >
              New form
            </CustomButton>
          )}
        </div>
      </header>
      {(metadataError || availableError) && (
        <section className="flex flex-col gap-4 rounded-3xl bg-rose-50 p-5 text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-bold">Forms workspace could not be loaded</h2>
              <p className="mt-1 text-sm text-rose-600">
                No form or submission was changed. Check the connection and try again.
              </p>
            </div>
          </div>
          <CustomButton
            variant="secondary"
            onClick={() => void Promise.all([refreshMetadata(), refreshAvailable()])}
            startIcon={<RotateCw className="h-4 w-4" />}
          >
            Try again
          </CustomButton>
        </section>
      )}
      <nav className="flex flex-wrap gap-1 rounded-2xl bg-white p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === item.key ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === 'available' && (
        <>
          <div className="relative">
            <Search className="absolute left-4 top-3 h-4 w-4 text-slate-600" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${fieldClass} bg-white pl-11`}
              placeholder="Search available forms…"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableLoading &&
              [0, 1, 2].map((item) => (
                <div key={item} className="h-48 animate-pulse rounded-3xl bg-white" />
              ))}
            {visibleAvailable.map((form) => (
              <article key={form._id} className="rounded-3xl bg-white p-5">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {form.category}
                </span>
                <h2 className="mt-3 text-lg font-black text-slate-900">{form.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {form.description || `${form.fields.length} fields`}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-slate-600">
                    v{form.version} · {form.workflow.length} approval steps
                  </span>
                  <CustomButton variant="primary" onClick={() => setFilling(form)}>
                    Open
                  </CustomButton>
                </div>
              </article>
            ))}
            {!availableLoading && !visibleAvailable.length && (
              <div className="rounded-3xl bg-white md:col-span-2 xl:col-span-3">
                <Empty
                  title={available.length ? 'No forms match your search' : 'No forms available yet'}
                  subTitle={
                    available.length
                      ? 'Try a different form name or category.'
                      : 'Published forms available to your role will appear here.'
                  }
                />
              </div>
            )}
          </div>
        </>
      )}
      {tab === 'mine' && (
        <section className="rounded-2xl bg-white p-4">
          {mine.length ? (
            <CustomTable<ISubmission>
              columns={submissionColumns}
              data={mine}
              actions={mineActions}
            />
          ) : (
            <Empty
              title="No submissions yet"
              subTitle="Open an available form to create your first governed request."
            />
          )}
        </section>
      )}
      {tab === 'inbox' && (
        <section className="rounded-2xl bg-white p-4">
          {inbox.length ? (
            <CustomTable<ISubmission>
              columns={submissionColumns}
              data={inbox}
              actions={inboxActions}
            />
          ) : (
            <Empty
              title="Approval inbox is clear"
              subTitle="Requests assigned to your active role will appear here."
            />
          )}
        </section>
      )}
      {tab === 'manage' && (
        <div className="space-y-5">
          <section>
            <div className="mb-3">
              <h2 className="font-black text-slate-900">Start from a template</h2>
              <p className="text-xs text-slate-500">
                Use a familiar starting point, then customise questions and approvals.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {FORM_TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="rounded-2xl bg-white p-4 text-left transition hover:-translate-y-0.5"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {template.category}
                  </span>
                  <p className="mt-2 font-bold text-slate-800">{template.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{template.description}</p>
                </button>
              ))}
            </div>
          </section>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {managed.map((form) => (
              <article key={form._id} className="rounded-3xl bg-white p-5">
                <div className="flex justify-between">
                  <Status value={form.status} />
                  <span className="text-xs text-slate-600">v{form.version}</span>
                </div>
                <h2 className="mt-4 font-black text-slate-900">{form.name}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {form.fields.length} fields · {form.workflow.length} steps
                </p>
                <div className="mt-5 flex gap-2">
                  <CustomButton variant="secondary" onClick={() => openEdit(form)}>
                    Create new version
                  </CustomButton>
                  {form.status === 'draft' && (
                    <CustomButton variant="primary" onClick={() => submitForReview(form)}>
                      Submit for review
                    </CustomButton>
                  )}
                  {form.status === 'pending_review' && (
                    <CustomButton variant="primary" onClick={() => publish(form)}>
                      Publish
                    </CustomButton>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      {tab === 'responses' && (
        <section className="space-y-4 rounded-2xl bg-white p-4">
          <div className="flex justify-end">
            <CustomButton
              variant="secondary"
              onClick={exportResponses}
              disabled={!responses.length}
              startIcon={<Download className="h-4 w-4" />}
            >
              Export response register
            </CustomButton>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Total', responses.length],
              ['In review', responses.filter((row) => row.status === 'in_review').length],
              ['Approved', responses.filter((row) => row.status === 'approved').length],
              ['Rejected', responses.filter((row) => row.status === 'rejected').length],
            ].map(([label, count]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xl font-black text-slate-900">{count}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <CustomTable<ISubmission> columns={submissionColumns} data={responses} />
        </section>
      )}
      {filling && (
        <Modal title={filling.name} onClose={() => setFilling(null)}>
          <div className="grid gap-4">
            {filling.fields
              .filter((field) => {
                if (!field.condition) return true;
                const matches =
                  String(values[field.condition.fieldKey] ?? '') === String(field.condition.value);
                return field.condition.operator === 'equals' ? matches : !matches;
              })
              .map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
                  files={files[field.key] ?? []}
                  onUpload={(file) => uploadFile(field.key, file)}
                  onRemove={async () => setFiles((current) => ({ ...current, [field.key]: [] }))}
                />
              ))}
            <div className="flex justify-end">
              <CustomButton
                variant="primary"
                onClick={submit}
                loading={isLoading}
                startIcon={<Send className="h-4 w-4" />}
              >
                Submit form
              </CustomButton>
            </div>
          </div>
        </Modal>
      )}
      {deciding && (
        <Modal title={`Review ${deciding.formName}`} onClose={() => setDeciding(null)}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {deciding.schemaSnapshot.map((field) => (
                <div key={field.key} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-600">{field.label}</p>
                  <p className="mt-1 break-words text-sm text-slate-800">
                    {field.type === 'file' && deciding.data[field.key] ? (
                      <a
                        href={String(deciding.data[field.key])}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary"
                      >
                        Open uploaded evidence
                      </a>
                    ) : (
                      String(deciding.data[field.key] ?? '—')
                    )}
                  </p>
                </div>
              ))}
            </div>
            <textarea
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              rows={3}
              placeholder="Decision note (required for rejection)"
              className={fieldClass}
            />
            {deciding.decisions?.length ? (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Approval timeline
                </p>
                {deciding.decisions.map((item) => (
                  <div key={`${item.step}-${item.decidedAt}`} className="text-xs text-slate-600">
                    Step {item.step} · {item.decision} by {item.decidedByName}
                    {item.note ? ` — ${item.note}` : ''}
                  </div>
                ))}
              </div>
            ) : null}
            {deciding.stepDueAt && (
              <div
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
                  new Date(deciding.stepDueAt).getTime() < renderedAt
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                <Clock3 className="h-4 w-4" />
                {new Date(deciding.stepDueAt).getTime() < renderedAt
                  ? 'This approval is overdue'
                  : `Decision due ${new Date(deciding.stepDueAt).toLocaleString('en-IN')}`}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <CustomButton
                variant="secondary"
                onClick={() => decide('rejected')}
                startIcon={<X className="h-4 w-4" />}
              >
                Reject
              </CustomButton>
              <CustomButton
                variant="primary"
                onClick={() => decide('approved')}
                startIcon={<Check className="h-4 w-4" />}
              >
                Approve step
              </CustomButton>
            </div>
          </div>
        </Modal>
      )}
      {delegationOpen && (
        <DelegationModal
          delegations={delegations}
          roles={metadata?.roles ?? []}
          onClose={() => setDelegationOpen(false)}
          onRefresh={refreshDelegations}
          onRevoke={revokeDelegation}
        />
      )}
      {designer && (
        <Modal
          title={editingId ? 'Edit form version' : 'Create form'}
          onClose={() => setDesigner(false)}
          wide
        >
          <div className="grid gap-5">
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1">
              {[
                ['build', 'Questions', <Plus key="build" className="h-4 w-4" />],
                ['preview', 'Preview', <Eye key="preview" className="h-4 w-4" />],
                ['settings', 'Workflow', <Settings2 key="settings" className="h-4 w-4" />],
              ].map(([key, label, icon]) => (
                <button
                  key={String(key)}
                  type="button"
                  onClick={() => setDesignerTab(key as typeof designerTab)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                    designerTab === key ? 'bg-white text-primary' : 'text-slate-500'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Form name"
                className={fieldClass}
              />
              <input
                value={slug}
                onChange={(event) =>
                  setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                }
                placeholder="unique-form-slug"
                className={fieldClass}
              />
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Category"
                className={fieldClass}
              />
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                className={fieldClass}
              />
            </div>
            {designerTab === 'preview' && (
              <div className="mx-auto w-full max-w-2xl rounded-3xl bg-slate-50 p-5">
                <div className="mb-5 border-t-8 border-primary rounded-2xl bg-white p-5">
                  <h2 className="text-2xl font-black text-slate-900">{name || 'Untitled form'}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {description || 'Add a description to help people complete this form.'}
                  </p>
                  <p className="mt-3 text-xs text-red-500">* Required</p>
                </div>
                <div className="space-y-3">
                  {formFields.map((field) => (
                    <div key={field.key} className="rounded-2xl bg-white p-5">
                      <DynamicField
                        field={field}
                        value={undefined}
                        onChange={() => undefined}
                        files={[]}
                        onUpload={async () => false}
                        onRemove={async () => undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {designerTab === 'build' && (
              <DesignerSection
                title="Questions"
                onAdd={() =>
                  setFormFields((current) => [...current, blankField(current.length + 1)])
                }
              >
                {formFields.map((field, index) => (
                  <div
                    key={`${field.key}-${index}`}
                    draggable
                    onDragStart={() => setDraggedField(index)}
                    onDragEnd={() => setDraggedField(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorderField(index)}
                    className="rounded-2xl border-l-4 border-primary bg-white p-4 ring-1 ring-slate-100"
                  >
                    <div className="grid items-center gap-3 md:grid-cols-[24px_1fr_190px]">
                      <GripVertical
                        className="h-5 w-5 cursor-grab text-slate-300"
                        aria-label="Drag to reorder question"
                      />
                      <input
                        value={field.label}
                        onChange={(event) =>
                          setFormFields((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    label: event.target.value,
                                    key: item.key.startsWith('field_')
                                      ? toKey(event.target.value, item.key)
                                      : item.key,
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="Question"
                        className={fieldClass}
                      />
                      <select
                        value={field.type}
                        onChange={(event) =>
                          setFormFields((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, type: event.target.value as TFieldType }
                                : item,
                            ),
                          )
                        }
                        className={fieldClass}
                      >
                        {(metadata?.fieldTypes ?? []).map((type) => (
                          <option key={type} value={type}>
                            {FIELD_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <input
                        value={field.placeholder ?? ''}
                        onChange={(event) =>
                          updateField(setFormFields, index, { placeholder: event.target.value })
                        }
                        placeholder="Response placeholder (optional)"
                        className={fieldClass}
                      />
                      <input
                        value={field.helpText ?? ''}
                        onChange={(event) =>
                          updateField(setFormFields, index, { helpText: event.target.value })
                        }
                        placeholder="Help text (optional)"
                        className={fieldClass}
                      />
                    </div>
                    {field.type === 'select' && (
                      <input
                        value={(field.options ?? []).join(', ')}
                        onChange={(event) =>
                          updateField(setFormFields, index, {
                            options: event.target.value
                              .split(',')
                              .map((value) => value.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Choices separated by commas"
                        className={`${fieldClass} mt-3`}
                      />
                    )}
                    {field.type === 'number' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={field.min ?? ''}
                          onChange={(event) =>
                            updateField(setFormFields, index, {
                              min:
                                event.target.value === '' ? undefined : Number(event.target.value),
                            })
                          }
                          placeholder="Minimum"
                          className={fieldClass}
                        />
                        <input
                          type="number"
                          value={field.max ?? ''}
                          onChange={(event) =>
                            updateField(setFormFields, index, {
                              max:
                                event.target.value === '' ? undefined : Number(event.target.value),
                            })
                          }
                          placeholder="Maximum"
                          className={fieldClass}
                        />
                      </div>
                    )}
                    {index > 0 && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={Boolean(field.condition)}
                            onChange={(event) =>
                              updateField(setFormFields, index, {
                                condition: event.target.checked
                                  ? {
                                      fieldKey: formFields[index - 1]!.key,
                                      operator: 'equals',
                                      value: '',
                                    }
                                  : undefined,
                              })
                            }
                          />
                          Show this question only when…
                        </label>
                        {field.condition && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <select
                              value={field.condition.fieldKey}
                              onChange={(event) =>
                                updateField(setFormFields, index, {
                                  condition: {
                                    ...field.condition!,
                                    fieldKey: event.target.value,
                                  },
                                })
                              }
                              className={fieldClass}
                            >
                              {formFields.slice(0, index).map((candidate) => (
                                <option key={candidate.key} value={candidate.key}>
                                  {candidate.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={field.condition.operator}
                              onChange={(event) =>
                                updateField(setFormFields, index, {
                                  condition: {
                                    ...field.condition!,
                                    operator: event.target.value as 'equals' | 'not_equals',
                                  },
                                })
                              }
                              className={fieldClass}
                            >
                              <option value="equals">Equals</option>
                              <option value="not_equals">Does not equal</option>
                            </select>
                            <input
                              value={String(field.condition.value)}
                              onChange={(event) =>
                                updateField(setFormFields, index, {
                                  condition: { ...field.condition!, value: event.target.value },
                                })
                              }
                              placeholder="Value"
                              className={fieldClass}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3">
                      <label className="text-xs">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) =>
                            setFormFields((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, required: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />{' '}
                        Required
                      </label>
                      <button
                        type="button"
                        title="Duplicate question"
                        onClick={() =>
                          setFormFields((current) => [
                            ...current.slice(0, index + 1),
                            {
                              ...field,
                              key: `${field.key}_${Date.now().toString().slice(-5)}`.slice(0, 50),
                              label: `${field.label} copy`,
                            },
                            ...current.slice(index + 1),
                          ])
                        }
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormFields((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        className="rounded-lg bg-red-50 p-2 text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </DesignerSection>
            )}
            {designerTab === 'settings' && (
              <>
                <DesignerSection
                  title="Approval workflow"
                  onAdd={() =>
                    setWorkflow((current) => [
                      ...current,
                      {
                        sequence: current.length + 1,
                        name: `Approval ${current.length + 1}`,
                        approverRoles: [],
                        allowSelfApproval: false,
                        slaHours: 48,
                        escalationRoles: [],
                      },
                    ])
                  }
                >
                  {workflow.map((step, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_130px_auto]"
                    >
                      <input
                        value={step.name}
                        onChange={(event) =>
                          setWorkflow((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                        className={fieldClass}
                      />
                      <select
                        value={step.approverRoles[0] ?? ''}
                        onChange={(event) =>
                          setWorkflow((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, approverRoles: [event.target.value] }
                                : item,
                            ),
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="">Select approver role</option>
                        {(metadata?.roles ?? []).map((role) => (
                          <option key={role.name} value={role.name}>
                            {role.displayName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={step.escalationRoles?.[0] ?? ''}
                        onChange={(event) =>
                          setWorkflow((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    escalationRoles: event.target.value ? [event.target.value] : [],
                                  }
                                : item,
                            ),
                          )
                        }
                        className={fieldClass}
                        aria-label="Escalation role"
                      >
                        <option value="">Default escalation</option>
                        {(metadata?.roles ?? []).map((role) => (
                          <option key={role.name} value={role.name}>
                            {role.displayName}
                          </option>
                        ))}
                      </select>
                      <label className="relative">
                        <input
                          type="number"
                          min={1}
                          max={720}
                          value={step.slaHours ?? 48}
                          onChange={(event) =>
                            setWorkflow((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, slaHours: Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }
                          className={fieldClass}
                        />
                        <span className="absolute right-3 top-3 text-[10px] text-slate-600">
                          hours
                        </span>
                      </label>
                      <button
                        onClick={() =>
                          setWorkflow((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        className="rounded-lg bg-red-50 p-2 text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </DesignerSection>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Who can submit (empty means all roles)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(metadata?.roles ?? []).map((role) => (
                      <button
                        key={role.name}
                        onClick={() =>
                          setSubmissionRoles((current) =>
                            current.includes(role.name)
                              ? current.filter((value) => value !== role.name)
                              : [...current, role.name],
                          )
                        }
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${submissionRoles.includes(role.name) ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {role.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end">
              <CustomButton variant="primary" onClick={saveDefinition} loading={isLoading}>
                Save draft
              </CustomButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DelegationModal({
  delegations,
  roles,
  onClose,
  onRefresh,
  onRevoke,
}: {
  delegations: IWorkflowDelegation[];
  roles: Array<{ name: string; displayName: string }>;
  onClose: () => void;
  onRefresh: () => Promise<unknown>;
  onRevoke: (id: string) => Promise<void>;
}) {
  const { mutation, isLoading } = useMutation();
  const schema = Yup.object({
    delegateId: Yup.string().required('Select a delegate'),
    role: Yup.string().required('Select the approval role'),
    startsAt: Yup.date().required('Start date is required'),
    endsAt: Yup.date()
      .min(Yup.ref('startsAt'), 'End date must be after the start date')
      .required('End date is required'),
    reason: Yup.string().trim().max(1000),
  });
  return (
    <Modal title="Approval delegation" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-slate-500">
          Temporarily let a colleague act for one of your approval roles. Every delegated decision
          remains attributed to both people in the audit trail.
        </p>
        <Formik
          initialValues={{ delegateId: '', role: '', startsAt: '', endsAt: '', reason: '' }}
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            const response = await mutation('form-workflow/delegations', {
              method: 'POST',
              body: values,
            });
            if (!response?.results?.success) return;
            toast.success('Approval delegation scheduled');
            helpers.resetForm();
            await onRefresh();
          }}
        >
          {({ values, setFieldValue }) => (
            <Form className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AsyncSelect
                  type="users"
                  label="Delegate"
                  required
                  value={values.delegateId}
                  onChange={(value) => setFieldValue('delegateId', value ?? '')}
                  placeholder="Search active users"
                />
                <ErrorMessage name="delegateId">
                  {(message) => <p className="mt-1 text-xs text-red-500">{message}</p>}
                </ErrorMessage>
              </div>
              <label className="text-sm font-semibold text-slate-700">
                Approval role *
                <Field as="select" name="role" className={fieldClass}>
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.name} value={role.name}>
                      {role.displayName}
                    </option>
                  ))}
                </Field>
                <ErrorMessage name="role">
                  {(message) => <p className="mt-1 text-xs text-red-500">{message}</p>}
                </ErrorMessage>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Reason
                <Field name="reason" className={fieldClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Starts *
                <Field type="datetime-local" name="startsAt" className={fieldClass} />
                <ErrorMessage name="startsAt">
                  {(message) => <p className="mt-1 text-xs text-red-500">{message}</p>}
                </ErrorMessage>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Ends *
                <Field type="datetime-local" name="endsAt" className={fieldClass} />
                <ErrorMessage name="endsAt">
                  {(message) => <p className="mt-1 text-xs text-red-500">{message}</p>}
                </ErrorMessage>
              </label>
              <div className="flex justify-end sm:col-span-2">
                <CustomButton type="submit" loading={isLoading}>
                  Schedule delegation
                </CustomButton>
              </div>
            </Form>
          )}
        </Formik>
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-800">Active and upcoming delegations</h3>
          {!delegations.length && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
              No delegations scheduled.
            </p>
          )}
          {delegations.map((item) => {
            const delegate =
              typeof item.delegateId === 'string' ? 'Selected colleague' : item.delegateId.name;
            return (
              <div
                key={item._id}
                className="flex flex-col justify-between gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {item.role.replaceAll('_', ' ')} · {delegate}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(item.startsAt).toLocaleString('en-IN')} –{' '}
                    {new Date(item.endsAt).toLocaleString('en-IN')}
                  </p>
                </div>
                {item.canRevoke && (
                  <button
                    type="button"
                    onClick={() => onRevoke(item._id)}
                    className="text-left text-xs font-semibold text-red-600"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function DynamicField({
  field,
  value,
  onChange,
  files,
  onUpload,
  onRemove,
}: {
  field: IField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  files: IUploadedFile[];
  onUpload: (file: File) => Promise<boolean>;
  onRemove: () => Promise<void>;
}) {
  if (field.type === 'file')
    return (
      <InlineFileUpload
        label={field.label}
        required={field.required}
        files={files}
        onUpload={onUpload}
        onRemove={onRemove}
      />
    );
  if (field.type === 'checkbox')
    return (
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        {field.label}
      </label>
    );
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {field.label}
        {field.required ? ' *' : ''}
      </span>
      {field.type === 'textarea' ? (
        <textarea
          required={field.required}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className={fieldClass}
        />
      ) : field.type === 'select' ? (
        <select
          required={field.required}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClass}
        >
          <option value="">Select</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          required={field.required}
          type={field.type === 'phone' ? 'tel' : field.type}
          value={String(value ?? '')}
          onChange={(event) =>
            onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)
          }
          placeholder={field.placeholder}
          className={fieldClass}
        />
      )}
      {field.helpText && <p className="mt-1 text-xs text-slate-600">{field.helpText}</p>}
    </label>
  );
}
function DesignerSection({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-bold text-primary">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${value === 'approved' || value === 'published' ? 'bg-emerald-50 text-emerald-700' : value === 'rejected' || value === 'archived' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}
    >
      {value.replace('_', ' ')}
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
        className={`max-h-[94dvh] w-full overflow-y-auto rounded-3xl bg-white p-6 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}
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

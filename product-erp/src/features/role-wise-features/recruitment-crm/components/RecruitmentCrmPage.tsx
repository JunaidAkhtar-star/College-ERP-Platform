'use client';

import AdmissionWorkflowBar from '@/shared/components/AdmissionWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Plus, Target, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import type {
  IRecruitmentDashboard,
  IRecruitmentLead,
  IRecruitmentList,
  TRecruitmentSource,
  TRecruitmentStage,
} from '../types/recruitment-crm.types';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}
interface ILeadForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: TRecruitmentSource;
  programInterest: string;
  consentToContact: boolean;
  nextFollowUpAt: string;
}
const initialValues: ILeadForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  source: 'website',
  programInterest: '',
  consentToContact: false,
  nextFollowUpAt: '',
};
const schema = Yup.object({
  firstName: Yup.string().trim().required('First name is required').max(120),
  lastName: Yup.string().trim().max(120),
  email: Yup.string().trim().email('Enter a valid email'),
  phone: Yup.string()
    .trim()
    .matches(/^[+\d][\d\s()-]{6,23}$/, 'Enter a valid phone number')
    .required('Phone is required'),
  source: Yup.string().required('Source is required'),
  programInterest: Yup.string(),
  consentToContact: Yup.boolean(),
  nextFollowUpAt: Yup.string(),
});
const stageLabel = (value: string) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const displayDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : 'Not scheduled';

export default function RecruitmentCrmPage() {
  const [stage, setStage] = useState<TRecruitmentStage | ''>('');
  const [showForm, setShowForm] = useState(false);
  const listPath = `recruitment-crm?limit=100${stage ? `&stage=${stage}` : ''}`;
  const {
    data: listRaw,
    isLoading,
    error,
    mutate,
  } = useSwr<IApiResponse<IRecruitmentList>>(listPath);
  const { data: dashboardRaw } = useSwr<IApiResponse<IRecruitmentDashboard>>(
    'recruitment-crm/dashboard',
  );
  const { mutation, isLoading: saving } = useMutation();
  const list = listRaw?.data;
  const dashboard = dashboardRaw?.data;
  const columns: Column<IRecruitmentLead>[] = [
    {
      field: 'firstName',
      title: 'Prospect',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">
            {row.firstName} {row.lastName}
          </p>
          <p className="text-xs text-slate-600">
            {row.phone}
            {row.email ? ` · ${row.email}` : ''}
          </p>
        </div>
      ),
    },
    {
      field: 'stage',
      title: 'Stage',
      render: (row) => (
        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary">
          {stageLabel(row.stage)}
        </span>
      ),
    },
    {
      field: 'programInterest',
      title: 'Programme',
      render: (row) => row.programInterest?.name ?? 'Not selected',
    },
    {
      field: 'score',
      title: 'Readiness',
      render: (row) => <span className="font-semibold text-slate-700">{row.score}%</span>,
    },
    { field: 'ownerId', title: 'Owner', render: (row) => row.ownerId?.name ?? 'Unassigned' },
    {
      field: 'nextFollowUpAt',
      title: 'Next follow-up',
      render: (row) => (
        <span
          className={
            row.nextFollowUpAt && new Date(row.nextFollowUpAt) < new Date()
              ? 'font-medium text-red-600'
              : 'text-slate-600'
          }
        >
          {displayDate(row.nextFollowUpAt)}
        </span>
      ),
    },
  ];
  async function submit(values: ILeadForm) {
    const response = await mutation('recruitment-crm', {
      method: 'POST',
      body: {
        ...values,
        email: values.email || undefined,
        programInterest: values.programInterest || undefined,
        nextFollowUpAt: values.nextFollowUpAt || undefined,
      },
    });
    if (response?.results?.success) {
      toast.success('Prospect added to recruitment pipeline');
      setShowForm(false);
      await mutate();
    }
  }
  return (
    <div className="space-y-5 p-4 md:p-6">
      <AdmissionWorkflowBar />
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recruitment CRM</h1>
          <p className="text-sm text-slate-500">
            Capture prospects, assign ownership, and keep every follow-up visible.
          </p>
        </div>
        <CustomButton onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add prospect
        </CustomButton>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            'Active pipeline',
            Object.entries(dashboard?.stages ?? {})
              .filter(([key]) => !['lost', 'enrolled'].includes(key))
              .reduce((sum, [, count]) => sum + (count ?? 0), 0),
          ],
          ['Due today', dashboard?.dueToday ?? 0],
          ['Overdue', dashboard?.overdue ?? 0],
          ['Unassigned', dashboard?.unassigned ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            '',
            'new',
            'contacted',
            'qualified',
            'application_started',
            'applied',
            'enrolled',
            'lost',
          ] as const
        ).map((item) => (
          <button
            key={item || 'all'}
            onClick={() => setStage(item)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${stage === item ? 'bg-primary text-white' : 'bg-white text-slate-600'}`}
          >
            {item ? stageLabel(item) : 'All prospects'}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}
      <CustomTable<IRecruitmentLead>
        columns={columns}
        data={list?.data ?? []}
        isLoading={isLoading}
        title="Prospect pipeline"
        subtitle={`${list?.total ?? 0} prospects`}
        onRefresh={() => mutate()}
        options={{ export: true, responsive: true, bordered: false }}
      />
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-primary-50 p-2 text-primary">
                  <Target className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-900">Add prospect</h2>
                  <p className="text-xs text-slate-500">Required fields are marked *</p>
                </div>
              </div>
              <button aria-label="Close" onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <Formik initialValues={initialValues} validationSchema={schema} onSubmit={submit}>
              <Form className="grid gap-4 sm:grid-cols-2">
                {[
                  ['firstName', 'First name *'],
                  ['lastName', 'Last name'],
                  ['email', 'Email'],
                  ['phone', 'Phone *'],
                ].map(([name, label]) => (
                  <label key={name} className="text-sm font-medium text-slate-700">
                    {label}
                    <Field
                      name={name}
                      className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                    />
                    <ErrorMessage name={name}>
                      {(message) => (
                        <span className="mt-1 block text-xs text-red-500">{message}</span>
                      )}
                    </ErrorMessage>
                  </label>
                ))}
                <label className="text-sm font-medium text-slate-700">
                  Source *
                  <Field
                    as="select"
                    name="source"
                    className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2.5"
                  >
                    {(
                      [
                        'website',
                        'walk_in',
                        'referral',
                        'campaign',
                        'school_visit',
                        'other',
                      ] as const
                    ).map((item) => (
                      <option key={item} value={item}>
                        {stageLabel(item)}
                      </option>
                    ))}
                  </Field>
                </label>
                <Field name="programInterest">
                  {({
                    field,
                    form,
                  }: {
                    field: { value: string };
                    form: { setFieldValue: (name: string, value: string) => void };
                  }) => (
                    <AsyncSelect
                      type="programs"
                      params={{ admissionOnly: true }}
                      label="Programme interest"
                      value={field.value}
                      onChange={(value) => form.setFieldValue('programInterest', value ?? '')}
                      placeholder="Search programmes"
                    />
                  )}
                </Field>
                <label className="text-sm font-medium text-slate-700">
                  Next follow-up
                  <Field
                    type="datetime-local"
                    name="nextFollowUpAt"
                    className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2.5"
                  />
                </label>
                <label className="flex items-center gap-2 self-end rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                  <Field type="checkbox" name="consentToContact" />
                  Consent to contact recorded
                </label>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <CustomButton type="button" variant="cancel" onClick={() => setShowForm(false)}>
                    Cancel
                  </CustomButton>
                  <CustomButton type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Add prospect'}
                  </CustomButton>
                </div>
              </Form>
            </Formik>
          </div>
        </div>
      )}
    </div>
  );
}

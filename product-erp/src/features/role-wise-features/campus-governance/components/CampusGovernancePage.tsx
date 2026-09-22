'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Action, type Column } from '@/shared/core/CustomTable';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import { useAuthStore } from '@/shared/store/authStore';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import {
  CalendarDays,
  ChartNoAxesCombined,
  Network,
  Plus,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import CampusGovernanceInsights from './CampusGovernanceInsights';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}
interface ICampus extends Record<string, unknown> {
  _id: string;
  code: string;
  name: string;
  type: 'campus' | 'school' | 'learning_center';
  parentCampusId?: string | { _id: string; code: string; name: string };
  timezone: string;
  address: { city: string; state: string; country: string };
  status: string;
}
interface IAssignment extends Record<string, unknown> {
  _id: string;
  campusId: string | ICampus;
  userId: string | { _id: string; name: string; email: string; roles: string[] };
  scopeRole: string;
  isPrimary: boolean;
  startsAt: string;
  endsAt?: string;
}
interface ICalendar extends Record<string, unknown> {
  _id: string;
  campusId: string | ICampus;
  academicYear: string;
  name: string;
  status: string;
  events: Array<{ title: string; category: string; startAt: string; endAt: string }>;
  createdBy?: string | { _id?: string };
}
interface IService extends Record<string, unknown> {
  _id: string;
  code: string;
  name: string;
  serviceType: string;
  providerCampusId: string | ICampus;
  consumerCampusIds: Array<string | ICampus>;
  allocationMethod: string;
  annualBudget?: number;
  status: string;
}
interface IMetric extends Record<string, unknown> {
  campus: ICampus;
  departments: number;
  students: number;
  faculty: number;
  finance: { assessed: number; collected: number; outstanding: number };
}
type TModal = 'campus' | 'assignment' | 'calendar' | 'service' | 'binding' | null;
const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10';
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
const nameOf = (value: string | { name: string }) =>
  typeof value === 'string' ? 'Campus' : value.name;

function CampusGovernancePage() {
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const canCreate = useHasPermission('user_management', 'create');
  const canEdit = useHasPermission('user_management', 'edit');
  const canApprove = useHasPermission('user_management', 'approve');
  const canDelete = useHasPermission('user_management', 'delete');
  const canManageInstitution = canCreate || canEdit;
  const canEditCalendars = canCreate || canEdit;
  const canPublishCalendars = canApprove;
  const canManageServices = canCreate || canEdit;
  const [tab, setTab] = useState<'overview' | 'campuses' | 'access' | 'calendars' | 'services'>(
    'overview',
  );
  const [modal, setModal] = useState<TModal>(null);
  const { mutation, isLoading } = useMutation();
  const {
    data: campusesRaw,
    error: campusesError,
    mutate: refreshCampuses,
    isValidating: refreshingCampuses,
  } = useSwr<IApiResponse<ICampus[]>>('campus-governance/campuses');
  const {
    data: assignRaw,
    error: assignmentsError,
    mutate: refreshAssignments,
    isValidating: refreshingAssignments,
  } = useSwr<IApiResponse<IAssignment[]>>('campus-governance/assignments');
  const {
    data: calendarRaw,
    error: calendarsError,
    mutate: refreshCalendars,
    isValidating: refreshingCalendars,
  } = useSwr<IApiResponse<ICalendar[]>>('campus-governance/calendars');
  const {
    data: serviceRaw,
    error: servicesError,
    mutate: refreshServices,
    isValidating: refreshingServices,
  } = useSwr<IApiResponse<IService[]>>('campus-governance/shared-services');
  const {
    data: metricsRaw,
    error: metricsError,
    mutate: refreshMetrics,
  } = useSwr<IApiResponse<IMetric[]>>('campus-governance/metrics');
  const campuses = campusesRaw?.data ?? [],
    assignments = assignRaw?.data ?? [],
    calendars = calendarRaw?.data ?? [],
    services = serviceRaw?.data ?? [],
    metrics = metricsRaw?.data ?? [];
  const save = async (
    path: string,
    method: 'POST' | 'PUT',
    body: unknown,
    message: string,
    refresh: () => Promise<unknown>,
  ) => {
    const response = await mutation(path, { method, body });
    if (!response?.results?.success) return;
    toast.success(message);
    setModal(null);
    await Promise.all([refresh(), refreshMetrics()]);
  };
  const campusColumns: Column<ICampus>[] = [
    {
      field: 'code',
      title: 'Campus',
      render: (r) => (
        <div>
          <p className="font-semibold">
            {r.code} · {r.name}
          </p>
          <p className="text-xs capitalize text-slate-600">{r.type.replace('_', ' ')}</p>
        </div>
      ),
    },
    {
      field: 'parentCampusId',
      title: 'Parent',
      render: (r) => (r.parentCampusId ? nameOf(r.parentCampusId) : 'Institution root'),
    },
    { field: 'address', title: 'Location', render: (r) => `${r.address.city}, ${r.address.state}` },
    { field: 'timezone', title: 'Timezone' },
    { field: 'status', title: 'Status', render: (r) => <Badge value={r.status} /> },
  ];
  const assignmentColumns: Column<IAssignment>[] = [
    {
      field: 'userId',
      title: 'Person',
      render: (r) =>
        typeof r.userId === 'string' ? (
          'Assigned user'
        ) : (
          <div>
            <p className="font-medium">{r.userId.name}</p>
            <p className="text-xs text-slate-600">{r.userId.email}</p>
          </div>
        ),
    },
    { field: 'campusId', title: 'Campus', render: (r) => nameOf(r.campusId) },
    { field: 'scopeRole', title: 'Scope role', render: (r) => <Badge value={r.scopeRole} /> },
    { field: 'isPrimary', title: 'Primary', render: (r) => (r.isPrimary ? 'Yes' : 'No') },
    {
      field: 'startsAt',
      title: 'Period',
      render: (r) =>
        `${new Date(r.startsAt).toLocaleDateString('en-IN')}${r.endsAt ? ` – ${new Date(r.endsAt).toLocaleDateString('en-IN')}` : ' – ongoing'}`,
    },
  ];
  const revoke: Action<IAssignment>[] = [
    {
      tooltip: 'Revoke campus access',
      icon: <X className="h-4 w-4" />,
      onClick: async (r) => {
        const response = await mutation(`campus-governance/assignments/${r._id}`, {
          method: 'DELETE',
        });
        if (!response?.results?.success) return;
        toast.success('Campus access revoked');
        await refreshAssignments();
      },
    },
  ];
  const calendarColumns: Column<ICalendar>[] = [
    {
      field: 'name',
      title: 'Calendar',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.name}</p>
          <p className="text-xs text-slate-600">{r.academicYear}</p>
        </div>
      ),
    },
    { field: 'campusId', title: 'Campus', render: (r) => nameOf(r.campusId) },
    { field: 'events', title: 'Events', render: (r) => r.events.length },
    { field: 'status', title: 'Status', render: (r) => <Badge value={r.status} /> },
  ];
  const publish: Action<ICalendar>[] = [
    {
      tooltip: 'Publish calendar',
      icon: <CalendarDays className="h-4 w-4" />,
      hidden: (r) => {
        const creator =
          typeof r.createdBy === 'string' ? r.createdBy : String(r.createdBy?._id ?? '');
        return r.status !== 'draft' || creator === userId;
      },
      onClick: async (r) => {
        const response = await mutation(`campus-governance/calendars/${r._id}/publish`, {
          method: 'POST',
        });
        if (!response?.results?.success) return;
        toast.success('Campus calendar published');
        await refreshCalendars();
      },
    },
  ];
  const canAddForTab =
    (tab === 'access' && canManageInstitution) ||
    (tab === 'calendars' && canEditCalendars) ||
    (tab === 'services' && canManageServices) ||
    ((tab === 'overview' || tab === 'campuses') && canManageInstitution);
  const serviceColumns: Column<IService>[] = [
    {
      field: 'code',
      title: 'Service',
      render: (r) => (
        <div>
          <p className="font-semibold">
            {r.code} · {r.name}
          </p>
          <p className="text-xs capitalize text-slate-600">{r.serviceType}</p>
        </div>
      ),
    },
    { field: 'providerCampusId', title: 'Provider', render: (r) => nameOf(r.providerCampusId) },
    {
      field: 'consumerCampusIds',
      title: 'Consumers',
      render: (r) => r.consumerCampusIds.map(nameOf).join(', '),
    },
    { field: 'allocationMethod', title: 'Allocation', render: (r) => r.allocationMethod },
    {
      field: 'annualBudget',
      title: 'Budget',
      render: (r) => (r.annualBudget ? money(r.annualBudget) : 'Not set'),
    },
    { field: 'status', title: 'Status', render: (r) => <Badge value={r.status} /> },
  ];
  const tabs = [
    { key: 'overview', label: 'Overview', detail: 'Campus outcomes', icon: ChartNoAxesCombined },
    { key: 'campuses', label: 'Hierarchy', detail: `${campuses.length} locations`, icon: Network },
    {
      key: 'access',
      label: 'Access scope',
      detail: `${assignments.length} assignments`,
      icon: UsersRound,
    },
    {
      key: 'calendars',
      label: 'Calendars',
      detail: `${calendars.length} calendars`,
      icon: CalendarDays,
    },
    {
      key: 'services',
      label: 'Shared services',
      detail: `${services.length} agreements`,
      icon: ShieldCheck,
    },
  ] as const;
  const openSetupAction = (action: 'bind' | 'assignment' | 'calendar' | 'service') => {
    if (action === 'bind' && canManageInstitution) setModal('binding');
    if (action === 'assignment' && canManageInstitution) setModal('assignment');
    if (action === 'calendar' && canEditCalendars) setModal('calendar');
    if (action === 'service' && canManageServices) setModal('service');
  };
  return (
    <div className="space-y-5">
      {(campusesError || assignmentsError || calendarsError || servicesError || metricsError) && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {campusesError?.message ||
            assignmentsError?.message ||
            calendarsError?.message ||
            servicesError?.message ||
            metricsError?.message ||
            'Unable to load campus governance data.'}
        </div>
      )}
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Institutional governance
          </p>
          <h1 className="text-2xl font-black text-slate-950">Multi-campus Governance</h1>
          <p className="text-sm text-slate-500">
            Manage hierarchy, local authority, calendars, shared services and consolidated outcomes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageInstitution && (
            <CustomButton variant="secondary" onClick={() => setModal('binding')}>
              Bind department
            </CustomButton>
          )}
          {canAddForTab && (
            <CustomButton
              onClick={() =>
                setModal(
                  tab === 'access'
                    ? 'assignment'
                    : tab === 'calendars'
                      ? 'calendar'
                      : tab === 'services'
                        ? 'service'
                        : 'campus',
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add{' '}
              {tab === 'access'
                ? 'assignment'
                : tab === 'calendars'
                  ? 'calendar'
                  : tab === 'services'
                    ? 'service'
                    : 'campus'}
            </CustomButton>
          )}
        </div>
      </header>
      <nav
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Campus governance sections"
      >
        {tabs.map(({ key, label, detail, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${tab === key ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${tab === key ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-bold">{label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${tab === key ? 'text-white/75' : 'text-slate-400'}`}
              >
                {detail}
              </span>
            </span>
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <CampusGovernanceInsights
          metrics={metrics}
          assignments={assignments}
          calendars={calendars}
          services={services}
          onSetupAction={
            canManageInstitution || canEditCalendars || canManageServices
              ? openSetupAction
              : undefined
          }
        />
      )}
      {tab === 'campuses' && (
        <CustomTable
          columns={campusColumns}
          data={campuses}
          title="Campus hierarchy"
          subtitle="Institutional locations and reporting relationships"
          description="Review campus identity, parent hierarchy, operating timezone, location and lifecycle status."
          onRefresh={() => void Promise.all([refreshCampuses(), refreshMetrics()])}
          isRefreshing={refreshingCampuses}
          options={{ bordered: false, responsive: true, export: true, refresh: true }}
        />
      )}
      {tab === 'access' && (
        <CustomTable
          columns={assignmentColumns}
          data={assignments}
          actions={canDelete ? revoke : []}
          title="Campus access assignments"
          subtitle="Delegated campus authority and effective periods"
          description="Review who can operate within each campus scope, their responsibility and whether the location is primary."
          onRefresh={() => void refreshAssignments()}
          isRefreshing={refreshingAssignments}
          options={{ bordered: false, responsive: true, export: true, refresh: true }}
        />
      )}
      {tab === 'calendars' && (
        <CustomTable
          columns={calendarColumns}
          data={calendars}
          actions={canPublishCalendars ? publish : []}
          title="Campus calendars"
          subtitle="Campus-specific academic and operational dates"
          description="Manage draft calendars and independently publish approved schedules for each campus."
          onRefresh={() => void refreshCalendars()}
          isRefreshing={refreshingCalendars}
          options={{ bordered: false, responsive: true, export: true, refresh: true }}
        />
      )}
      {tab === 'services' && (
        <CustomTable
          columns={serviceColumns}
          data={services}
          title="Shared-service agreements"
          subtitle="Cross-campus services, ownership and allocation"
          description="Track which campus provides each service, participating consumers, accountable owners and annual budgets."
          onRefresh={() => void refreshServices()}
          isRefreshing={refreshingServices}
          options={{ bordered: false, responsive: true, export: true, refresh: true }}
        />
      )}
      {canManageInstitution && modal === 'campus' && (
        <CampusModal
          campuses={campuses}
          loading={isLoading}
          onClose={() => setModal(null)}
          onSubmit={(v) =>
            save('campus-governance/campuses', 'POST', v, 'Campus created', refreshCampuses)
          }
        />
      )}{' '}
      {canManageInstitution && modal === 'assignment' && (
        <AssignmentModal
          campuses={campuses}
          loading={isLoading}
          onClose={() => setModal(null)}
          onSubmit={(v) =>
            save(
              'campus-governance/assignments',
              'POST',
              v,
              'Campus access assigned',
              refreshAssignments,
            )
          }
        />
      )}{' '}
      {canEditCalendars && modal === 'calendar' && (
        <CalendarModal
          campuses={campuses}
          loading={isLoading}
          onClose={() => setModal(null)}
          onSubmit={(v) =>
            save(
              'campus-governance/calendars',
              'POST',
              v,
              'Campus calendar created',
              refreshCalendars,
            )
          }
        />
      )}{' '}
      {canManageServices && modal === 'service' && (
        <ServiceModal
          campuses={campuses}
          loading={isLoading}
          onClose={() => setModal(null)}
          onSubmit={(v) =>
            save(
              'campus-governance/shared-services',
              'POST',
              v,
              'Shared service created',
              refreshServices,
            )
          }
        />
      )}{' '}
      {canManageInstitution && modal === 'binding' && (
        <BindingModal
          campuses={campuses}
          loading={isLoading}
          onClose={() => setModal(null)}
          onSubmit={(departmentId, campusId) =>
            save(
              `campus-governance/departments/${departmentId}/campus`,
              'PUT',
              { campusId },
              'Department assigned to campus',
              refreshCampuses,
            )
          }
        />
      )}{' '}
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
function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const guidance: Record<string, string> = {
    'Register New Campus Location':
      'Create a governed institutional location. The hierarchy and status determine campus-scoped reporting and operational assignment.',
    'Assign Staff Campus Scope':
      'Delegate campus responsibility for a defined period. Choose the narrowest authority needed for the person’s duties.',
    'Create Campus Academic Calendar':
      'Build the campus schedule as a draft. A different authorised reviewer must publish it before it becomes effective.',
    'Create Shared Campus Service':
      'Document a service supplied across campuses, its accountable owner, consumers, budget and allocation basis.',
    'Bind Academic Department to Campus':
      'Connect the department to its operating location so students, faculty, finance and reporting inherit the correct campus scope.',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 sm:items-center sm:p-4">
      <div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{guidance[title]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CampusModal({
  campuses,
  loading,
  onClose,
  onSubmit,
}: {
  campuses: ICampus[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const schema = Yup.object({
    code: Yup.string()
      .trim()
      .min(2, 'Min 2 characters')
      .max(10, 'Max 10 characters')
      .matches(/^[A-Z0-9_-]+$/i, 'Alphanumeric, dashes or underscores only')
      .required('Campus code is required'),
    name: Yup.string().trim().min(3, 'Min 3 characters').required('Campus name is required'),
    type: Yup.string().required('Campus type is required'),
    timezone: Yup.string().required('Timezone is required'),
    status: Yup.string().required('Status is required'),
    address: Yup.object({
      line1: Yup.string().trim().required('Street address line 1 is required'),
      city: Yup.string().trim().required('City is required'),
      state: Yup.string().trim().required('State is required'),
      postalCode: Yup.string().trim().required('Postal code is required'),
      country: Yup.string().trim().required('Country is required'),
    }),
  });

  return (
    <Shell title="Register New Campus Location" onClose={onClose}>
      <Formik
        initialValues={{
          code: '',
          name: '',
          type: 'campus',
          parentCampusId: '',
          timezone: 'Asia/Kolkata',
          status: 'active',
          address: { line1: '', city: '', state: '', postalCode: '', country: 'India' },
        }}
        validationSchema={schema}
        onSubmit={onSubmit}
      >
        {() => (
          <Form className="space-y-6">
            {/* Section 1: Campus Identity */}
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Campus Identity & Hierarchy
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Campus Code *
                  </label>
                  <Field name="code" placeholder="e.g. MAIN-01, NORTH-CP" className={fieldClass} />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Short identifier used in student roll numbers, room numbers, and reports.
                  </p>
                  <ErrorMessage name="code">
                    {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Campus Name *
                  </label>
                  <Field
                    name="name"
                    placeholder="e.g. Main City Campus, Tech Park Branch"
                    className={fieldClass}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Full official name displayed across institution portals and certificates.
                  </p>
                  <ErrorMessage name="name">
                    {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Campus Type *
                  </label>
                  <Field as="select" name="type" className={fieldClass}>
                    <option value="campus">Main / Regional Campus</option>
                    <option value="school">Constituent School / Faculty</option>
                    <option value="learning_center">Off-Campus Learning Center</option>
                  </Field>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Categorizes the operational scale and regulatory reporting type.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Parent Campus (Hierarchy)
                  </label>
                  <Field as="select" name="parentCampusId" className={fieldClass}>
                    <option value="">Institution Root (Top Level)</option>
                    {campuses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </Field>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Leave as Root if this is a standalone campus, or select parent for sub-branches.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Physical Address & Timezone */}
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Location & Timezone Settings
              </h4>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Street Address Line 1 *
                </label>
                <Field
                  name="address.line1"
                  placeholder="Plot/Building No, Street Name"
                  className={fieldClass}
                />
                <ErrorMessage name="address.line1">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">City *</label>
                  <Field
                    name="address.city"
                    placeholder="e.g. Bhubaneswar"
                    className={fieldClass}
                  />
                  <ErrorMessage name="address.city">
                    {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">State *</label>
                  <Field name="address.state" placeholder="e.g. Odisha" className={fieldClass} />
                  <ErrorMessage name="address.state">
                    {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Postal Code *
                  </label>
                  <Field
                    name="address.postalCode"
                    placeholder="e.g. 751024"
                    className={fieldClass}
                  />
                  <ErrorMessage name="address.postalCode">
                    {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Country *</label>
                  <Field name="address.country" placeholder="e.g. India" className={fieldClass} />
                  <ErrorMessage name="address.country">
                    {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Operating Timezone *
                  </label>
                  <Field as="select" name="timezone" className={fieldClass}>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST - UTC-05:00)</option>
                    <option value="Europe/London">Europe/London (GMT - UTC+00:00)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST - UTC+04:00)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+08:00)</option>
                  </Field>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Drives biometric attendance timestamps, exam schedules, and gate pass approvals.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Operational Status *
                  </label>
                  <Field as="select" name="status" className={fieldClass}>
                    <option value="planned">Planned (Under Construction / Setup)</option>
                    <option value="active">Active (Fully Operational)</option>
                    <option value="inactive">Inactive (Temporarily Suspended)</option>
                  </Field>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Controls whether students can be assigned or enrolled into this campus.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Register Campus
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function AssignmentModal({
  campuses,
  loading,
  onClose,
  onSubmit,
}: {
  campuses: ICampus[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Assign Staff Campus Scope" onClose={onClose}>
      <Formik
        initialValues={{
          campusId: '',
          userId: '',
          scopeRole: 'leader',
          isPrimary: false,
          startsAt: new Date().toISOString().slice(0, 10),
          endsAt: '',
        }}
        validationSchema={Yup.object({
          campusId: Yup.string().required('Campus selection is required'),
          userId: Yup.string().required('Employee selection is required'),
          scopeRole: Yup.string().required('Scope role is required'),
          startsAt: Yup.date().required('Start date is required'),
          endsAt: Yup.date()
            .min(Yup.ref('startsAt'), 'End date must be after start date')
            .nullable(),
        })}
        onSubmit={onSubmit}
      >
        {({ values, setFieldValue }) => (
          <Form className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-800">
              Assigning a campus scope grants staff members operational oversight (e.g. Director,
              Warden, Accountant, HOD) specifically for the selected campus.
            </div>

            <div className="space-y-4">
              <div>
                <AsyncSelect
                  type="users"
                  label="Employee / Staff Member *"
                  required
                  value={values.userId}
                  onChange={(v) => setFieldValue('userId', v ?? '')}
                  placeholder="Search staff member by name, email, or employee ID..."
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Select the active user account who will be assigned this campus responsibility.
                </p>
                <ErrorMessage name="userId">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Target Campus *
                  </label>
                  <Field as="select" name="campusId" className={fieldClass}>
                    <option value="">Select campus location</option>
                    {campuses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </Field>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Physical campus where this staff member operates.
                  </p>
                  <ErrorMessage name="campusId">
                    {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Scope Authority Role *
                  </label>
                  <Field as="select" name="scopeRole" className={fieldClass}>
                    <option value="leader">Campus Director / Executive Leader</option>
                    <option value="academic">Dean Academic / Academic Incharge</option>
                    <option value="finance">Campus Finance Officer / Accountant</option>
                    <option value="operations">Campus Warden / Operations Manager</option>
                    <option value="viewer">Campus Auditor / Guest Viewer</option>
                  </Field>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Determines management and approval privileges for this campus.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Assignment Effective From *
                  </label>
                  <Field type="date" name="startsAt" className={fieldClass} />
                  <ErrorMessage name="startsAt">
                    {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                  </ErrorMessage>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Assignment End Date (Optional)
                  </label>
                  <Field type="date" name="endsAt" className={fieldClass} />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Leave blank for an ongoing, permanent assignment.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-800">
                  <Field
                    type="checkbox"
                    name="isPrimary"
                    className="h-4 w-4 rounded text-primary"
                  />
                  Set as {"Employee's"} Primary Campus Location
                </label>
                <p className="ml-7 mt-0.5 text-[11px] text-slate-500">
                  If checked, biometric attendance and default daily login routing will default to
                  this campus.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Assign Campus Scope
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function CalendarModal({
  campuses,
  loading,
  onClose,
  onSubmit,
}: {
  campuses: ICampus[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Create Campus Academic Calendar" onClose={onClose}>
      <Formik
        initialValues={{
          campusId: '',
          academicYear: '',
          name: '',
          events: [{ title: '', category: 'academic', startAt: '', endAt: '', description: '' }],
        }}
        validationSchema={Yup.object({
          campusId: Yup.string().required('Campus selection is required'),
          academicYear: Yup.string().required('Academic year is required'),
          name: Yup.string().trim().required('Calendar name is required'),
          events: Yup.array()
            .of(
              Yup.object({
                title: Yup.string().trim().required('Event title is required'),
                category: Yup.string().required('Category is required'),
                startAt: Yup.date().required('Start time is required'),
                endAt: Yup.date()
                  .min(Yup.ref('startAt'), 'End time must be after start time')
                  .required('End time is required'),
              }),
            )
            .min(1, 'At least one event is required'),
        })}
        onSubmit={onSubmit}
      >
        {({ values, setFieldValue }) => (
          <Form className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Campus *
                </label>
                <Field as="select" name="campusId" className={fieldClass}>
                  <option value="">Select campus</option>
                  {campuses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </Field>
                <ErrorMessage name="campusId">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Academic Year *
                </label>
                <AsyncSelect
                  type="academicYears"
                  value={values.academicYear || null}
                  onChange={(value) => setFieldValue('academicYear', value ?? '')}
                  placeholder="Select configured academic year"
                />
                <ErrorMessage name="academicYear">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Calendar Name *
                </label>
                <Field
                  name="name"
                  placeholder="e.g. Odd Sem Calendar 2026-27"
                  className={fieldClass}
                />
                <ErrorMessage name="name">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>
            </div>

            {/* Events Builder */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <FieldArray name="events">
                {({ push, remove }) => (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Calendar Events & Key Dates ({values.events.length})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Add holidays, exam periods, semester start/end dates, and campus events.
                        </p>
                      </div>
                      <CustomButton
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          push({
                            title: '',
                            category: 'academic',
                            startAt: '',
                            endAt: '',
                            description: '',
                          })
                        }
                        className="py-1! text-xs!"
                      >
                        + Add Event
                      </CustomButton>
                    </div>

                    {values.events.map((_, i) => (
                      <div
                        key={i}
                        className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 "
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600">
                              Event Title *
                            </label>
                            <Field
                              name={`events.${i}.title`}
                              placeholder="e.g. Mid-Term Examination Week, National Holiday"
                              className={fieldClass}
                            />
                            <ErrorMessage name={`events.${i}.title`}>
                              {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                            </ErrorMessage>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600">
                              Event Category *
                            </label>
                            <Field as="select" name={`events.${i}.category`} className={fieldClass}>
                              <option value="academic">Academic (Classes/Terms)</option>
                              <option value="holiday">Official Holiday</option>
                              <option value="exam">Examination Period</option>
                              <option value="operations">Administrative / Inspection</option>
                              <option value="community">Campus Fest / Event</option>
                            </Field>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600">
                              Starts At *
                            </label>
                            <Field
                              type="datetime-local"
                              name={`events.${i}.startAt`}
                              className={fieldClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600">
                              Ends At *
                            </label>
                            <Field
                              type="datetime-local"
                              name={`events.${i}.endAt`}
                              className={fieldClass}
                            />
                          </div>
                        </div>
                        {values.events.length > 1 && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => remove(i)}
                              className="text-xs font-medium text-red-500 hover:underline"
                            >
                              Remove Event
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </FieldArray>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Save Calendar Draft
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function ServiceModal({
  campuses,
  loading,
  onClose,
  onSubmit,
}: {
  campuses: ICampus[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell title="Create Shared Campus Service" onClose={onClose}>
      <Formik
        initialValues={{
          code: '',
          name: '',
          serviceType: 'library',
          providerCampusId: '',
          consumerCampusIds: [] as string[],
          allocationMethod: 'headcount',
          annualBudget: 0,
          startsAt: new Date().toISOString().slice(0, 10),
          endsAt: '',
          status: 'active',
          ownerId: '',
        }}
        validationSchema={Yup.object({
          code: Yup.string().trim().required('Service code is required'),
          name: Yup.string().trim().required('Service name is required'),
          providerCampusId: Yup.string().required('Provider campus is required'),
          consumerCampusIds: Yup.array().min(1, 'Select at least one consuming campus'),
          ownerId: Yup.string().required('Service owner is required'),
          startsAt: Yup.date().required('Start date is required'),
        })}
        onSubmit={onSubmit}
      >
        {({ values, setFieldValue }) => (
          <Form className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-800">
              Shared services allow central facilities (e.g. Central Library, Shared Buses, IT
              Datacenter) to be hosted at one provider campus and consumed across multiple branch
              campuses with cost allocation.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Service Code *</label>
                <Field
                  name="code"
                  placeholder="e.g. LIB-SHARED-01, BUS-FLEET-A"
                  className={fieldClass}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Unique identifier for budget tracking.
                </p>
                <ErrorMessage name="code">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Service Name *</label>
                <Field
                  name="name"
                  placeholder="e.g. Central Digital Library Service"
                  className={fieldClass}
                />
                <ErrorMessage name="name">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Service Type *</label>
                <Field as="select" name="serviceType" className={fieldClass}>
                  <option value="library">Library & Digital Repository</option>
                  <option value="transport">Transport & Bus Fleet</option>
                  <option value="procurement">Central Procurement & Store</option>
                  <option value="finance">Accounts & Treasury</option>
                  <option value="hr">HR & Payroll Center</option>
                  <option value="it">IT & Datacenter Infrastructure</option>
                  <option value="admissions">Central Admission Office</option>
                  <option value="other">Other Shared Facility</option>
                </Field>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Host / Provider Campus *
                </label>
                <Field as="select" name="providerCampusId" className={fieldClass}>
                  <option value="">Select hosting campus</option>
                  {campuses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </Field>
                <p className="mt-1 text-[11px] text-slate-500">
                  Physical campus location where the facility or team resides.
                </p>
                <ErrorMessage name="providerCampusId">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Consuming Campuses (Beneficiaries) *
              </label>
              <p className="mt-0.5 text-[11px] text-slate-500 mb-2">
                Click to select all branch campuses that utilize this shared service.
              </p>
              <div className="flex flex-wrap gap-2">
                {campuses
                  .filter((c) => c._id !== values.providerCampusId)
                  .map((c) => (
                    <button
                      type="button"
                      key={c._id}
                      onClick={() =>
                        setFieldValue(
                          'consumerCampusIds',
                          values.consumerCampusIds.includes(c._id)
                            ? values.consumerCampusIds.filter((id) => id !== c._id)
                            : [...values.consumerCampusIds, c._id],
                        )
                      }
                      className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${values.consumerCampusIds.includes(c._id) ? 'bg-primary text-white ' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {c.name}
                    </button>
                  ))}
              </div>
              <ErrorMessage name="consumerCampusIds">
                {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
              </ErrorMessage>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <AsyncSelect
                  type="users"
                  label="Service Owner / Manager *"
                  required
                  value={values.ownerId}
                  onChange={(v) => setFieldValue('ownerId', v ?? '')}
                  placeholder="Select staff manager..."
                />
                <ErrorMessage name="ownerId">
                  {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
                </ErrorMessage>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Cost Allocation Method *
                </label>
                <Field as="select" name="allocationMethod" className={fieldClass}>
                  <option value="headcount">Headcount (Proportional to Students/Staff)</option>
                  <option value="equal">Equal Split Across Campuses</option>
                  <option value="usage">Actual Metered Usage</option>
                  <option value="fixed">Fixed Flat Fee</option>
                </Field>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Annual Operational Budget (₹)
                </label>
                <Field
                  type="number"
                  name="annualBudget"
                  placeholder="e.g. 500000"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Effective Start Date *
                </label>
                <Field type="date" name="startsAt" className={fieldClass} />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Create Shared Service
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

function BindingModal({
  campuses,
  loading,
  onClose,
  onSubmit,
}: {
  campuses: ICampus[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (departmentId: string, campusId: string) => Promise<void>;
}) {
  return (
    <Shell title="Bind Academic Department to Campus" onClose={onClose}>
      <Formik
        initialValues={{ departmentId: '', campusId: '' }}
        validationSchema={Yup.object({
          departmentId: Yup.string().required('Department selection is required'),
          campusId: Yup.string().required('Campus selection is required'),
        })}
        onSubmit={(v) => onSubmit(v.departmentId, v.campusId)}
      >
        {({ values, setFieldValue }) => (
          <Form className="space-y-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-800">
              Binding an academic department to a physical campus ensures that new student
              enrollments, faculty profiles, and classroom allocations automatically scope to that
              campus.
            </div>

            <div>
              <AsyncSelect
                type="departments"
                label="Academic Department *"
                required
                value={values.departmentId}
                onChange={(v) => setFieldValue('departmentId', v ?? '')}
                placeholder="Search department..."
              />
              <ErrorMessage name="departmentId">
                {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
              </ErrorMessage>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Target Campus *</label>
              <Field as="select" name="campusId" className={fieldClass}>
                <option value="">Select target campus location</option>
                {campuses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </Field>
              <ErrorMessage name="campusId">
                {(m) => <p className="mt-1 text-xs font-medium text-red-500">{m}</p>}
              </ErrorMessage>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <CustomButton variant="tertiary" type="button" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={loading}>
                Bind Department
              </CustomButton>
            </div>
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

export default UseProtectedRoutes(CampusGovernancePage, undefined, [['user_management', 'view']]);

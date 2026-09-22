'use client';

import Drawer from '@mui/material/Drawer';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import {
  Building2,
  CreditCard,
  Database,
  Globe2,
  Pencil,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import type { ISubscriptionPlan, ITenant, ITenantUsage } from '../types/super-admin.types';

export interface ITenantEditValues {
  name: string;
  planId: string;
  subscriptionExpiresAt: string;
}

interface ITenantDetailsDrawerProps {
  tenant: ITenant | null;
  usage?: ITenantUsage;
  plans: ISubscriptionPlan[];
  editing: boolean;
  isSaving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (tenant: ITenant, values: ITenantEditValues) => Promise<void>;
  onManageSubscription?: (tenant: ITenant) => void;
}

const schema = Yup.object({
  name: Yup.string().trim().min(2).max(160).required('Organization name is required'),
  planId: Yup.string().required('Select an active plan'),
  subscriptionExpiresAt: Yup.date()
    .min(new Date(), 'Renewal date must be in the future')
    .required('Renewal date is required'),
});

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(
        new Date(value),
      )
    : 'Not configured';

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <div className="mt-1.5 break-words text-sm font-semibold text-slate-700">{value || '—'}</div>
    </div>
  );
}

export default function TenantDetailsDrawer({
  tenant,
  usage,
  plans,
  editing,
  isSaving,
  onClose,
  onEdit,
  onCancelEdit,
  onSave,
  onManageSubscription,
}: ITenantDetailsDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(tenant)}
      onClose={onClose}
      slotProps={{
        paper: { className: 'w-full max-w-2xl bg-white' },
        backdrop: { className: 'bg-slate-950/35 backdrop-blur-[2px]' },
      }}
    >
      {tenant && (
        <Formik<ITenantEditValues>
          enableReinitialize
          initialValues={{
            name: tenant.name,
            planId: tenant.planId ?? '',
            subscriptionExpiresAt: new Date(tenant.subscriptionExpiresAt)
              .toISOString()
              .slice(0, 10),
          }}
          validationSchema={schema}
          onSubmit={(values) => onSave(tenant, values)}
        >
          {({ values, errors, touched, handleChange }) => (
            <Form className="flex h-dvh min-h-0 flex-col">
              <header className="flex flex-none items-start justify-between gap-4 px-5 py-5 sm:px-7">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold text-slate-900">
                        {tenant.name}
                      </h2>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {tenant.tenantId}.erp.devvelocity.in
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close tenant details"
                  className="rounded-xl bg-slate-100 p-2.5 text-slate-600 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-6 sm:px-7">
                {editing ? (
                  <div className="space-y-5">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-600">Organization name</span>
                      <input
                        name="name"
                        value={values.name}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-100"
                      />
                      {touched.name && errors.name && (
                        <span className="mt-1 block text-xs text-rose-600">{errors.name}</span>
                      )}
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-600">Subscription plan</span>
                      <select
                        name="planId"
                        value={values.planId}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-100"
                      >
                        <option value="">Select a plan</option>
                        {plans
                          .filter((plan) => plan.isActive)
                          .map((plan) => (
                            <option key={plan._id} value={plan._id}>
                              {plan.name} · {plan.priceLabel}
                            </option>
                          ))}
                      </select>
                      {touched.planId && errors.planId && (
                        <span className="mt-1 block text-xs text-rose-600">{errors.planId}</span>
                      )}
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-600">Renewal date</span>
                      <input
                        type="date"
                        name="subscriptionExpiresAt"
                        value={values.subscriptionExpiresAt}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-100"
                      />
                      {touched.subscriptionExpiresAt && errors.subscriptionExpiresAt && (
                        <span className="mt-1 block text-xs text-rose-600">
                          {errors.subscriptionExpiresAt}
                        </span>
                      )}
                    </label>
                    <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                      Tenant ID and database name are immutable because they define routing and
                      database isolation.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Detail label="Status" value={tenant.status.replaceAll('_', ' ')} />
                      <Detail label="Billing" value={tenant.billingStatus?.replaceAll('_', ' ')} />
                      <Detail
                        label="Students"
                        value={(usage?.students ?? 0).toLocaleString('en-IN')}
                      />
                      <Detail
                        label="Staff"
                        value={(usage?.employees ?? 0).toLocaleString('en-IN')}
                      />
                    </div>
                    <section>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Database className="h-4 w-4 text-primary" /> Workspace
                      </h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Detail label="Tenant ID" value={tenant.tenantId} />
                        <Detail label="Database" value={tenant.databaseName} />
                        <Detail label="Created" value={formatDate(tenant.createdAt)} />
                        <Detail label="Last updated" value={formatDate(tenant.updatedAt)} />
                      </div>
                    </section>
                    <section>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <UsersRound className="h-4 w-4 text-primary" /> Capacity & subscription
                      </h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Detail label="Plan" value={usage?.planName || 'Custom plan'} />
                        <Detail
                          label="Renewal date"
                          value={formatDate(tenant.subscriptionExpiresAt)}
                        />
                        <Detail
                          label="Student limit"
                          value={(tenant.maxStudents ?? 0).toLocaleString('en-IN')}
                        />
                        <Detail
                          label="Employee limit"
                          value={(tenant.maxEmployees ?? 0).toLocaleString('en-IN')}
                        />
                        <Detail
                          label="Enabled modules"
                          value={
                            tenant.enabledModuleSlugs?.length ?? usage?.enabledModuleCount ?? 0
                          }
                        />
                        <Detail label="Add-ons" value={tenant.enabledAddonSlugs?.length ?? 0} />
                      </div>
                    </section>
                    <section>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Globe2 className="h-4 w-4 text-primary" /> Domain & security
                      </h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Detail
                          label="Managed domain"
                          value={`${tenant.tenantId}.erp.devvelocity.in`}
                        />
                        <Detail
                          label="Custom domain"
                          value={tenant.customDomain || 'Not configured'}
                        />
                        <Detail
                          label="Domain status"
                          value={
                            tenant.customDomainStatus?.replaceAll('_', ' ') || 'Not configured'
                          }
                        />
                        <Detail
                          label="SSL status"
                          value={tenant.sslStatus || 'Managed automatically'}
                        />
                        <Detail
                          label="Database health"
                          value={usage?.databaseReachable ? 'Online' : 'Unavailable'}
                        />
                        <Detail
                          label="Entitlements"
                          value={tenant.entitlementEnforced ? 'Enforced' : 'Legacy mode'}
                        />
                      </div>
                    </section>
                    {tenant.billingEmail && (
                      <section>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <ShieldCheck className="h-4 w-4 text-primary" /> Billing contact
                        </h3>
                        <div className="mt-3">
                          <Detail label="Email" value={tenant.billingEmail} />
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>

              <footer className="flex flex-none items-center justify-end gap-3 bg-white px-5 py-4 sm:px-7">
                {editing ? (
                  <>
                    <CustomButton type="button" variant="tertiary" onClick={onCancelEdit}>
                      Cancel
                    </CustomButton>
                    <CustomButton type="submit" variant="primary" loading={isSaving}>
                      Save changes
                    </CustomButton>
                  </>
                ) : (
                  <>
                    {onManageSubscription && (
                      <CustomButton
                        type="button"
                        variant="tertiary"
                        onClick={() => onManageSubscription(tenant)}
                        startIcon={<CreditCard className="h-4 w-4" />}
                      >
                        Manage plan
                      </CustomButton>
                    )}
                    <CustomButton
                      type="button"
                      variant="primary"
                      onClick={onEdit}
                      startIcon={<Pencil className="h-4 w-4" />}
                    >
                      Edit tenant
                    </CustomButton>
                  </>
                )}
              </footer>
            </Form>
          )}
        </Formik>
      )}
    </Drawer>
  );
}

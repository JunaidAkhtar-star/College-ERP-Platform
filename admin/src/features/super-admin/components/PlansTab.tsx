/** @file PlansTab.tsx @description Creates subscription plans from registered product modules. @module features/super-admin/components */
'use client';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { IProductAddon, IProductModule, ISubscriptionPlan } from '../types/super-admin.types';
import { useState } from 'react';
import { motion } from '@/shared/utils/motion';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import useSwr from '@/shared/hooks/useSwr';
import { Plus, X, Table, LayoutGrid, Landmark, CloudCog } from 'lucide-react';
import { useEffect } from 'react';
import Drawer from '@mui/material/Drawer';
interface IProps {
  plans: ISubscriptionPlan[];
  modules: IProductModule[];
  refresh: () => Promise<unknown>;
  isValidating?: boolean;
}
interface IValues {
  name: string;
  slug: string;
  description: string;
  priceLabel: string;
  studentLimit: number;
  employeeLimit: number;
  moduleSlugs: string[];
  highlights: string;
  planType: 'free' | 'paid';
  amountInRupees: number;
  pricingModel: 'per_user_day' | 'fixed';
  dailyRateRupees: number;
  minimumBillableUsers: number;
  billingPeriod: 'month' | 'year' | 'one_time';
  availableBillingPeriods: ('month' | 'year' | 'one_time')[];
  trialDays: number;
  graceDays: number;
  includedAddonSlugs: string[];
}
const schema = Yup.object({
  name: Yup.string().required(),
  slug: Yup.string()
    .matches(/^[a-z0-9-]+$/)
    .required(),
  description: Yup.string().required(),
  priceLabel: Yup.string().required(),
  studentLimit: Yup.number().min(0).required(),
  employeeLimit: Yup.number().min(0).required(),
  amountInRupees: Yup.number().min(0).required(),
  dailyRateRupees: Yup.number().min(0).required(),
  minimumBillableUsers: Yup.number().min(1).required(),
});
export default function PlansTab({ plans, modules, refresh, isValidating }: IProps) {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { mutation, isLoading } = useMutation();
  const { data: addonsResponse } = useSwr<{ data?: IProductAddon[] }>('super-admin/addons');
  const addons = addonsResponse?.data || [];
  const hasRegulatoryModule = modules.some(
    (module) => module.slug === 'government-regulatory-integrations',
  );
  const hasLmsModule = modules.some((module) => module.slug === 'lms-integrations');
  const hasMultiCampusModule = modules.some((module) => module.slug === 'multi-campus-governance');
  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);
  const create = async (values: IValues, reset: () => void) => {
    const response = await mutation('super-admin/plans', {
      method: 'POST',
      body: {
        ...values,
        highlights: values.highlights
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        amountInPaise: Math.round(values.amountInRupees * 100),
        dailyRatePaise: Math.round(values.dailyRateRupees * 100),
        isActive: true,
      },
    });
    if (response?.results?.success) {
      toast.success('Subscription plan created.');
      reset();
      setDrawerOpen(false);
      await refresh();
    }
  };
  const columns: Column<ISubscriptionPlan>[] = [
    { field: 'name', title: 'Plan', sortable: true },
    { field: 'priceLabel', title: 'Price' },
    { field: 'moduleSlugs', title: 'Modules', render: (row) => row.moduleSlugs.length },
    { field: 'studentLimit', title: 'Students', sortable: true },
    { field: 'employeeLimit', title: 'Employees', sortable: true },
    { field: 'isActive', title: 'Status', render: (row) => (row.isActive ? 'Active' : 'Inactive') },
  ];
  return (
    <div className="space-y-5">
      <div className="admin-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Subscription plans</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage commercial packages, capacity limits and included product access.
          </p>
        </div>
        <CustomButton
          variant="primary"
          size="small"
          startIcon={<Plus className="size-4" />}
          onClick={() => setDrawerOpen(true)}
        >
          Create plan
        </CustomButton>
      </div>
      {hasRegulatoryModule && (
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-950">
          <span className="rounded-xl bg-white p-2 text-primary shadow-sm">
            <Landmark className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Government integration commercial policy</p>
            <p className="mt-1 leading-6 text-blue-800">
              Include the module with Enterprise, or sell its registered add-on with Professional.
              Authority eligibility, onboarding and provider charges remain separately billable.
            </p>
          </div>
        </div>
      )}
      {hasLmsModule && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/80 p-4 text-sm text-violet-950">
          <span className="rounded-xl bg-white p-2 text-violet-700 shadow-sm">
            <CloudCog className="size-5" />
          </span>
          <div>
            <p className="font-semibold">LMS integration commercial policy</p>
            <p className="mt-1 leading-6 text-violet-800">
              Included with Professional and Enterprise; available to Growth through the LMS add-on.
              Canvas, Moodle, OneRoster and Coursera licences or API access remain provider charges.
            </p>
          </div>
        </div>
      )}
      {hasMultiCampusModule && (
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
          <p className="font-semibold">Multi-campus commercial policy</p>
          <p className="mt-1 leading-5">
            Included with Enterprise; available to Professional through the Multi-Campus Governance
            add-on. Campus access remains separately controlled by ERP RBAC.
          </p>
        </div>
      )}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            className: 'w-full max-w-2xl bg-white',
          },
          backdrop: {
            className: 'bg-slate-950/35 backdrop-blur-[2px]',
          },
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-plan-title"
          className="h-dvh w-full overflow-hidden bg-white"
        >
          <Formik<IValues>
            initialValues={{
              name: '',
              slug: '',
              description: '',
              priceLabel: '',
              studentLimit: 500,
              employeeLimit: 50,
              moduleSlugs: [],
              highlights: '',
              planType: 'paid',
              amountInRupees: 0,
              pricingModel: 'fixed',
              dailyRateRupees: 0,
              minimumBillableUsers: 1,
              billingPeriod: 'year',
              availableBillingPeriods: ['month', 'year'],
              trialDays: 7,
              graceDays: 5,
              includedAddonSlugs: [],
            }}
            validationSchema={schema}
            onSubmit={(values, helpers) => create(values, helpers.resetForm)}
          >
            {({ values, handleChange, setFieldValue }) => (
              <Form className="flex h-dvh min-h-0 flex-col">
                <header className="flex flex-none items-start justify-between gap-4 bg-white px-5 py-5 sm:px-7">
                  <div>
                    <h2 id="create-plan-title" className="text-xl font-semibold text-slate-800">
                      Create subscription plan
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Bundle registered modules and define commercial capacity.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close plan form"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                  >
                    <X className="size-5" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-5 py-6 sm:px-7">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        'name',
                        'slug',
                        'priceLabel',
                        'description',
                        'studentLimit',
                        'employeeLimit',
                        'amountInRupees',
                        'dailyRateRupees',
                        'minimumBillableUsers',
                        'trialDays',
                        'graceDays',
                        'highlights',
                      ] as const
                    ).map((field) => (
                      <label key={field}>
                        <span className="text-xs font-semibold capitalize text-slate-600">
                          {field === 'amountInRupees'
                            ? 'Stable yearly price (₹)'
                            : field.replaceAll(/([A-Z])/g, ' $1')}
                        </span>
                        <input
                          name={field}
                          type={
                            field.includes('Limit') ||
                            field.includes('Days') ||
                            field === 'amountInRupees' ||
                            field === 'dailyRateRupees' ||
                            field === 'minimumBillableUsers'
                              ? 'number'
                              : 'text'
                          }
                          value={values[field]}
                          onChange={handleChange}
                          className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Pricing model
                      <select
                        name="pricingModel"
                        value={values.pricingModel}
                        onChange={handleChange}
                        className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm"
                      >
                        <option value="per_user_day">Per user / day</option>
                        <option value="fixed">Fixed plan price</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Plan type
                      <select
                        name="planType"
                        value={values.planType}
                        onChange={handleChange}
                        className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm"
                      >
                        <option value="paid">Paid</option>
                        <option value="free">Free</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Customer billing choices
                      <span className="mt-2 flex min-h-12 items-center gap-4 rounded-2xl bg-slate-100 px-4">
                        {(['month', 'year'] as const).map((period) => (
                          <span key={period} className="flex items-center gap-2 capitalize">
                            <input
                              type="checkbox"
                              checked={values.availableBillingPeriods.includes(period)}
                              onChange={(event) =>
                                setFieldValue(
                                  'availableBillingPeriods',
                                  event.target.checked
                                    ? [...values.availableBillingPeriods, period]
                                    : values.availableBillingPeriods.filter(
                                        (selected) => selected !== period,
                                      ),
                                )
                              }
                            />
                            {period === 'month' ? 'Monthly' : 'Yearly'}
                          </span>
                        ))}
                      </span>
                    </label>
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-semibold text-slate-600">Included modules</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {modules.map((module) => (
                        <label
                          key={module._id}
                          className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={values.moduleSlugs.includes(module.slug)}
                            onChange={(event) =>
                              setFieldValue(
                                'moduleSlugs',
                                event.target.checked
                                  ? [...values.moduleSlugs, module.slug]
                                  : values.moduleSlugs.filter((slug) => slug !== module.slug),
                              )
                            }
                          />
                          {module.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  {addons.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs font-semibold text-slate-600">
                        Included premium add-ons
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {addons.map((addon) => (
                          <label
                            key={addon._id}
                            className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={values.includedAddonSlugs.includes(addon.slug)}
                              onChange={(event) =>
                                setFieldValue(
                                  'includedAddonSlugs',
                                  event.target.checked
                                    ? [...values.includedAddonSlugs, addon.slug]
                                    : values.includedAddonSlugs.filter(
                                        (slug) => slug !== addon.slug,
                                      ),
                                )
                              }
                            />
                            {addon.name} · ₹{(addon.amountInPaise / 100).toLocaleString('en-IN')}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <footer className="flex flex-none justify-end gap-2 bg-white px-5 py-4 sm:px-7">
                  <CustomButton
                    type="button"
                    variant="tertiary"
                    size="medium"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Cancel
                  </CustomButton>
                  <CustomButton type="submit" variant="primary" size="medium" loading={isLoading}>
                    Create plan
                  </CustomButton>
                </footer>
              </Form>
            )}
          </Formik>
        </div>
      </Drawer>
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 border border-slate-200/60 shadow-xs">
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={() => setView('table')}
              aria-label="Table view"
              className={`relative cursor-pointer inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors duration-200 ${
                view === 'table'
                  ? 'text-primary-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {view === 'table' && (
                <motion.div
                  layoutId="plansViewActivePill"
                  className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Table className="relative z-10 h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-30 shadow-md">
              Table view
            </span>
          </div>
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-label="Grid view"
              className={`relative cursor-pointer inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors duration-200 ${
                view === 'grid'
                  ? 'text-primary-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {view === 'grid' && (
                <motion.div
                  layoutId="plansViewActivePill"
                  className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <LayoutGrid className="relative z-10 h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-30 shadow-md">
              Grid view
            </span>
          </div>
        </div>
      </div>
      {view === 'table' ? (
        <CustomTable
          data={plans as unknown as Record<string, unknown>[]}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          onRefresh={refresh}
          isValidating={isValidating}
          options={{ pagination: true, search: true, sorting: true, refresh: true }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan._id} className="admin-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
                </div>
                <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-bold text-primary">
                  {plan.priceLabel}
                </span>
              </div>
              <p className="mt-5 text-sm font-semibold text-slate-700">
                {plan.moduleSlugs.length} modules
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {plan.studentLimit.toLocaleString('en-IN')} students ·{' '}
                {plan.employeeLimit.toLocaleString('en-IN')} employees
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @file ProvisionTenantModal.tsx
 * @description Formik-governed tenant checkout-registration drawer for plan and administrator setup.
 * @module features/super-admin/components
 */

'use client';

import Drawer from '@mui/material/Drawer';
import { Form, Formik } from 'formik';
import { Building2, Check, GraduationCap, LayoutDashboard, Users, X } from 'lucide-react';
import * as Yup from 'yup';
import CustomButton from '@/shared/core/CustomButton';
import type { IProductAddon, ISubscriptionPlan } from '../types/super-admin.types';

interface IProvisionValues {
  tenantId: string;
  name: string;
  adminEmail: string;
  planId: string;
  addonSlugs: string[];
}

interface IProvisionTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: IProvisionValues) => Promise<void>;
  muting: boolean;
  plans: ISubscriptionPlan[];
  addons: IProductAddon[];
}

const fieldClass =
  'w-full rounded-lg bg-slate-200/70 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:bg-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/30';
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const errorClass = 'mt-1.5 block text-xs font-medium text-rose-600';

const schema = Yup.object({
  name: Yup.string()
    .trim()
    .min(2, 'Enter a valid institution name')
    .required('Institution name is required'),
  tenantId: Yup.string()
    .trim()
    .matches(/^[a-z0-9][a-z0-9-]{2,49}$/, 'Use 3–50 lowercase letters, numbers or hyphens')
    .required('Tenant subdomain is required'),
  planId: Yup.string().required('Select a subscription plan'),
  adminEmail: Yup.string()
    .trim()
    .email('Enter a valid email address')
    .required('Administrator email is required'),
  addonSlugs: Yup.array().of(Yup.string().required()).defined(),
});

const initialValues = (): IProvisionValues => ({
  tenantId: '',
  name: '',
  adminEmail: '',
  planId: '',
  addonSlugs: [],
});

const RequiredMark = () => <span className="text-rose-600"> *</span>;

export default function ProvisionTenantModal({
  isOpen,
  onClose,
  onConfirm,
  muting,
  plans,
  addons,
}: IProvisionTenantModalProps) {
  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      slotProps={{
        paper: { className: 'w-full max-w-2xl bg-white' },
        backdrop: { className: 'bg-slate-950/35 backdrop-blur-[2px]' },
      }}
    >
      <Formik<IProvisionValues>
        initialValues={initialValues()}
        validationSchema={schema}
        enableReinitialize
        onSubmit={onConfirm}
      >
        {({ values, errors, touched, handleChange, handleBlur, setFieldValue, setValues }) => {
          const selectedPlan = plans.find((plan) => plan._id === values.planId);
          const availableAddons = addons.filter(
            (addon) =>
              addon.isActive &&
              addon.featureKeys.includes('mobile.app') &&
              !selectedPlan?.includedAddonSlugs.includes(addon.slug),
          );
          const selectedAddons = addons.filter((addon) => values.addonSlugs.includes(addon.slug));
          const studentCapacity =
            (selectedPlan?.studentLimit ?? 0) +
            selectedAddons.reduce(
              (total, addon) => total + (addon.capacityBoost?.additionalStudents ?? 0),
              0,
            );
          const staffCapacity =
            (selectedPlan?.employeeLimit ?? 0) +
            selectedAddons.reduce(
              (total, addon) => total + (addon.capacityBoost?.additionalEmployees ?? 0),
              0,
            );
          const moduleCount = new Set([
            ...(selectedPlan?.moduleSlugs ?? []),
            ...selectedAddons.flatMap((addon) => addon.moduleSlugs),
          ]).size;
          return (
            <Form noValidate className="flex h-dvh min-h-0 flex-col bg-white">
              <header className="flex flex-none items-start justify-between gap-4 px-5 py-5 sm:px-7">
                <div>
                  <div className="flex items-center gap-2 text-primary">
                    <Building2 className="size-5" />
                    <span className="text-xs font-bold uppercase tracking-[0.14em]">
                      Tenant operations
                    </span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">Register new tenant</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Start the governed billing and approval workflow for an institution workspace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close tenant drawer"
                  className="rounded-lg bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                >
                  <X className="size-5" />
                </button>
              </header>

              <section className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-6 sm:px-7">
                <div>
                  <label htmlFor="tenant-name" className={labelClass}>
                    Institution name
                    <RequiredMark />
                  </label>
                  <input
                    id="tenant-name"
                    name="name"
                    value={values.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter college or university name"
                    className={fieldClass}
                  />
                  {touched.name && errors.name && <span className={errorClass}>{errors.name}</span>}
                </div>

                <div>
                  <label htmlFor="tenant-id" className={labelClass}>
                    Tenant subdomain
                    <RequiredMark />
                  </label>
                  <input
                    id="tenant-id"
                    name="tenantId"
                    value={values.tenantId}
                    onBlur={handleBlur}
                    onChange={(event) =>
                      setValues({ ...values, tenantId: event.target.value.toLowerCase() })
                    }
                    placeholder="Enter tenant subdomain"
                    className={fieldClass}
                  />
                  {touched.tenantId && errors.tenantId && (
                    <span className={errorClass}>{errors.tenantId}</span>
                  )}
                </div>

                <p className="rounded-lg bg-primary-50 px-4 py-3 text-sm leading-6 text-primary-800">
                  The workspace ID <strong>{values.tenantId || 'institution-id'}</strong> is
                  reserved now. Its private database is created only after payment verification and
                  required administrator approval.
                </p>

                <div>
                  <label htmlFor="tenant-plan" className={labelClass}>
                    Subscription plan
                    <RequiredMark />
                  </label>
                  <select
                    id="tenant-plan"
                    name="planId"
                    value={values.planId}
                    onBlur={handleBlur}
                    onChange={(event) => {
                      setValues({
                        ...values,
                        planId: event.target.value,
                        addonSlugs: [],
                      });
                    }}
                    className={fieldClass}
                  >
                    <option value="">Select an active plan</option>
                    {plans
                      .filter((plan) => plan.isActive && plan.planType === 'paid')
                      .map((plan) => (
                        <option key={plan._id} value={plan._id}>
                          {plan.name} — {plan.priceLabel}/{plan.billingPeriod}
                        </option>
                      ))}
                  </select>
                  {touched.planId && errors.planId && (
                    <span className={errorClass}>{errors.planId}</span>
                  )}
                </div>

                {selectedPlan && (
                  <div className="rounded-xl bg-white p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg bg-primary-50 p-3">
                        <GraduationCap className="mx-auto size-4 text-primary" />
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {studentCapacity.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-slate-500">Students</p>
                      </div>
                      <div className="rounded-lg bg-primary-50 p-3">
                        <Users className="mx-auto size-4 text-primary" />
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {staffCapacity.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-slate-500">Staff</p>
                      </div>
                      <div className="rounded-lg bg-primary-50 p-3">
                        <LayoutDashboard className="mx-auto size-4 text-primary" />
                        <p className="mt-1 text-lg font-bold text-slate-900">{moduleCount}</p>
                        <p className="text-xs text-slate-500">Modules</p>
                      </div>
                    </div>
                    {selectedPlan.highlights.length > 0 && (
                      <div className="mt-4 space-y-2 text-sm text-slate-600">
                        {selectedPlan.highlights.slice(0, 4).map((highlight) => (
                          <p key={highlight} className="flex gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                            {highlight}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedPlan?.planType !== 'free' && availableAddons.length > 0 && (
                  <div>
                    <p className={labelClass}>Optional applications</p>
                    <div className="space-y-2">
                      {availableAddons.map((addon) => (
                        <label
                          key={addon._id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-4"
                        >
                          <input
                            type="checkbox"
                            checked={values.addonSlugs.includes(addon.slug)}
                            onChange={(event) =>
                              void setFieldValue(
                                'addonSlugs',
                                event.target.checked
                                  ? [...values.addonSlugs, addon.slug]
                                  : values.addonSlugs.filter((slug) => slug !== addon.slug),
                              )
                            }
                            className="mt-1 size-4 accent-primary"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-slate-800">
                              {addon.name} · ₹{(addon.amountInPaise / 100).toLocaleString('en-IN')}/
                              {addon.billingPeriod}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              {addon.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div>
                    <label htmlFor="admin-email" className={labelClass}>
                      Administrator email
                      <RequiredMark />
                    </label>
                    <input
                      id="admin-email"
                      type="email"
                      name="adminEmail"
                      value={values.adminEmail}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Enter administrator email"
                      className={fieldClass}
                    />
                    {touched.adminEmail && errors.adminEmail && (
                      <span className={errorClass}>{errors.adminEmail}</span>
                    )}
                  </div>
                  <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-xs leading-5 text-slate-600">
                    The server generates credentials only after billing and approval gates pass and
                    the workspace is ready. The administrator must change the password at first
                    login.
                  </p>
                </div>
              </section>

              <footer className="flex flex-none justify-end gap-3 bg-white px-5 py-4 sm:px-7">
                <CustomButton type="button" variant="tertiary" size="medium" onClick={onClose}>
                  Cancel
                </CustomButton>
                <CustomButton type="submit" variant="primary" size="medium" loading={muting}>
                  Create checkout registration
                </CustomButton>
              </footer>
            </Form>
          );
        }}
      </Formik>
    </Drawer>
  );
}

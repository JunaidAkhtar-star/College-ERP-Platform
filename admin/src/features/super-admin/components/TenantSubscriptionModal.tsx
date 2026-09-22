/**
 * @file TenantSubscriptionModal.tsx
 * @description Governed plan and renewal editor for an existing SaaS tenant.
 * @module features/super-admin/components
 */

'use client';

import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { X } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import { ISubscriptionPlan, ITenant } from '../types/super-admin.types';

interface ITenantSubscriptionValues {
  planId: string;
  subscriptionExpiresAt: string;
}

interface ITenantSubscriptionModalProps {
  tenant: ITenant | null;
  plans: ISubscriptionPlan[];
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (tenant: ITenant, values: ITenantSubscriptionValues) => Promise<void>;
}

const subscriptionSchema = Yup.object({
  planId: Yup.string().required('Select an active plan'),
  subscriptionExpiresAt: Yup.date()
    .min(new Date(), 'Renewal date must be in the future')
    .required('Renewal date is required'),
});

/** Edits only commercial subscription fields supported by the platform API. */
export default function TenantSubscriptionModal({
  tenant,
  plans,
  isLoading,
  onClose,
  onConfirm,
}: ITenantSubscriptionModalProps) {
  if (!tenant) return null;
  const initialValues: ITenantSubscriptionValues = {
    planId: tenant.planId ?? '',
    subscriptionExpiresAt: new Date(tenant.subscriptionExpiresAt).toISOString().slice(0, 10),
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Manage subscription</h2>
            <p className="mt-1 text-sm text-slate-500">{tenant.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 p-2 text-slate-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Formik
          initialValues={initialValues}
          validationSchema={subscriptionSchema}
          enableReinitialize
          onSubmit={(values) => onConfirm(tenant, values)}
        >
          {({ values, errors, touched, handleChange }) => (
            <Form className="mt-7 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-600">Subscription plan</span>
                <select
                  name="planId"
                  value={values.planId}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary-100"
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
                  className="mt-2 w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary-100"
                />
                {touched.subscriptionExpiresAt && errors.subscriptionExpiresAt && (
                  <span className="mt-1 block text-xs text-rose-600">
                    {errors.subscriptionExpiresAt}
                  </span>
                )}
              </label>

              <div className="rounded-2xl bg-primary-50 p-4 text-sm leading-6 text-primary-800">
                Changing the plan updates module entitlements and licensed student and employee
                limits immediately.
              </div>
              <div className="flex justify-end gap-3">
                <CustomButton type="button" variant="tertiary" onClick={onClose}>
                  Cancel
                </CustomButton>
                <CustomButton type="submit" variant="primary" loading={isLoading}>
                  Save subscription
                </CustomButton>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}

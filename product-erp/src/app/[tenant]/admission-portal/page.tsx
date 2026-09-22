/**
 * @file page.tsx
 * @description Standalone admission portal for applicants. Handles its own
 *   auth gate (it does NOT go through the role-scoped DefaultLayout), fetches
 *   the applicant's own application, and dynamically renders one of two
 *   feature components:
 *     - `ApplicationFormPage` (draft) — self-service multi-step form
 *     - `ApplicantStatusPage` (submitted onward) — status / progress view
 * @module app/admission-portal
 */
'use client';

import React, { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useAuthStore } from '@/shared/store/authStore';
import useSwr from '@/shared/hooks/useSwr';
import type { IApplicantApplication } from '@/features/role-wise-features/admission/types/applicant-status.types';
import { getTenantRolePath } from '@/shared/utils';

function Spinner() {
  return (
    <div className="flex h-dvh w-full items-center justify-center">
      <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
    </div>
  );
}

const ApplicationFormPage = dynamic(
  () => import('@/features/role-wise-features/admission/components/ApplicationFormPage'),
  { loading: () => <Spinner /> },
);

const ApplicantStatusPage = dynamic(
  () => import('@/features/role-wise-features/admission/components/ApplicantStatusPage'),
  { loading: () => <Spinner /> },
);

export default function AdmissionPortalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && !accessToken) router.replace('/auth/signin');
  }, [hydrated, accessToken, router]);

  // Already-enrolled students should not be on this portal — send to dashboard.
  // A missing applicationStatus does NOT imply the user has no draft —
  // the actual application is fetched below from `admission/my-application`.
  useEffect(() => {
    if (!hydrated || !user) return;
    const appStatus = (user as { applicationStatus?: string }).applicationStatus;
    if (appStatus === 'enrolled') {
      const role = (user.role || user.roles?.[0]) as string | undefined;
      if (role) router.replace(getTenantRolePath(role, '/dashboard'));
    }
  }, [hydrated, user, router]);

  const {
    data: appResp,
    isLoading,
    mutate,
  } = useSwr<{ data?: IApplicantApplication } | IApplicantApplication>(
    accessToken ? 'admission/my-application' : null,
  );

  // useSwr returns the JSON envelope, so the real application lives under
  // `.data` for the standard `{ success, data: {...} }` shape. Fall back
  // to the value itself if a route ever returns it unwrapped.
  const app: IApplicantApplication | undefined =
    (appResp as { data?: IApplicantApplication } | undefined)?.data ??
    (appResp as IApplicantApplication | undefined);

  // When the applicant has just submitted (`?submitted=1`), the SWR cache may
  // still hold the stale "draft" response. Force a revalidation exactly once
  // so the portal instantly transitions to ApplicantStatusPage.
  const didRevalidate = useRef(false);
  useEffect(() => {
    if (searchParams.get('submitted') === '1' && !didRevalidate.current) {
      didRevalidate.current = true;
      mutate();
    }
  }, [searchParams, mutate]);

  const appStatus = (user as { applicationStatus?: string } | null)?.applicationStatus;

  // While re-validating after submission, show the spinner to avoid a flicker
  // back to ApplicationFormPage with the stale draft data.
  const isRevalidatingAfterSubmit =
    searchParams.get('submitted') === '1' && app?.status === 'draft';

  if (!hydrated || !accessToken || isLoading || isRevalidatingAfterSubmit) return <Spinner />;

  if (!app) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No application found</h2>
        <p className="mt-2 text-sm text-slate-500">
          We could not find an admission application linked to your account. Please contact the
          admission cell.
        </p>
      </div>
    );
  }

  // The fetched application is authoritative. Draft applicants must always be
  // able to complete their form, regardless of a stale session status.
  if (app.status === 'draft') {
    return <ApplicationFormPage selfService />;
  }

  // Registration number and section allotment are post-enrollment gates only.
  // They must never block Draft, Submitted, Under Review, or Approved applicants.
  if (
    app.status === 'enrolled' &&
    (appStatus === 'pending_registration' || appStatus === 'pending_allotment')
  ) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full rounded-3xl bg-white p-8 border border-slate-100  text-center">
          <div className="h-14 w-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto mb-6">
            <svg
              className="h-7 w-7 animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Portal Access Pending</h2>
          <p className="mt-4 text-sm text-slate-500 leading-relaxed">
            {appStatus === 'pending_registration'
              ? 'Your university registration number from BPUT has not yet been received. Once updated by the Admin Office, your student portal access will be enabled.'
              : 'Your section/batch assignment is currently pending with the Academics Cell. You will have full access once your allotment is completed.'}
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
            <p className="text-[11px] text-slate-600 font-medium">
              Please contact the Admission Office / Academics Cell for assistance.
            </p>
            <button
              onClick={() => {
                useAuthStore.getState().clearAuth();
                router.replace('/auth/signin');
              }}
              className="mt-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <ApplicantStatusPage app={app} onRefresh={mutate} />;
}

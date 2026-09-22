/**
 * @file page.tsx
 * @description Email verification + initial password setup landing page.
 *   Reached from the invite email link: /auth/activate?token=...
 *   Resolves the token, lets the user set their first password, then
 *   redirects to sign in.
 */
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { ShieldCheck, KeyRound, Loader2, AlertCircle } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';

interface IInviteInfo {
  name: string;
  email: string;
  facultyId?: string;
}

const schema = Yup.object({
  password: Yup.string().min(8, 'Min 8 characters').required('Password is required'),
  confirm: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm your password'),
});

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';

function ActivateAccountPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [info, setInfo] = useState<IInviteInfo | null>(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const { mutation, isLoading: saving } = useMutation();

  const isMissingToken = !token;
  const effectiveError = isMissingToken
    ? 'Missing invite token. Please use the link from your email.'
    : resolveError;
  const effectiveResolving = isMissingToken ? false : resolving;

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await mutation(`auth/invite/${encodeURIComponent(token)}`, {
          method: 'GET',
          silentError: true,
        });
        const body = response?.results as
          | {
              success?: boolean;
              data?: IInviteInfo;
              message?: string;
            }
          | undefined;
        if (cancelled) return;
        if (!response || !body?.success || !body?.data) {
          setResolveError(body?.message ?? 'This invite link is invalid or has expired.');
        } else {
          setInfo(body.data);
        }
      } catch {
        if (!cancelled) setResolveError('Could not verify the invite link. Please try again.');
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mutation, token]);

  const formik = useFormik({
    initialValues: { password: '', confirm: '' },
    validationSchema: schema,
    onSubmit: async (values) => {
      const res = await mutation('auth/invite/complete', {
        method: 'POST',
        body: { token, password: values.password },
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Account activated. Please sign in.');
        router.replace('/auth/signin');
      }
    },
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Activate Your Account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Verify your email and set your password to get started.
          </p>
        </div>

        {effectiveResolving && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying invite…
          </div>
        )}

        {!effectiveResolving && effectiveError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{effectiveError}</p>
          </div>
        )}

        {!effectiveResolving && info && (
          <form onSubmit={formik.handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs font-medium text-slate-500">Welcome</p>
              <p className="font-semibold text-slate-900">{info.name}</p>
              <p className="text-xs text-slate-500">{info.email}</p>
              {info.facultyId && (
                <p className="mt-1 text-xs">
                  Faculty ID: <span className="font-semibold text-primary">{info.facultyId}</span>
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">New Password</label>
              <input
                type="password"
                name="password"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Min 8 characters"
                className={inputCls}
              />
              {formik.touched.password && formik.errors.password && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.password}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirm"
                value={formik.values.confirm}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Re-enter password"
                className={inputCls}
              />
              {formik.touched.confirm && formik.errors.confirm && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.confirm}</p>
              )}
            </div>

            <CustomButton
              type="submit"
              loading={saving}
              startIcon={<KeyRound className="h-4 w-4" />}
              className="w-full!"
            >
              Activate &amp; Set Password
            </CustomButton>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={null}>
      <ActivateAccountPageInner />
    </Suspense>
  );
}

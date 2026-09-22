/**
 * @file ChangePasswordModal.tsx
 * @description Forced password change modal shown after login when the user's
 *   account was provisioned by an admin (mustChangePassword = true) or when
 *   their password has aged out. The modal cannot be dismissed until the
 *   change succeeds.
 */
'use client';

import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';

interface IProps {
  open: boolean;
  /** When true the modal also asks for the current password (normal flow). */
  requireCurrent?: boolean;
  onSuccess: () => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function ChangePasswordModal({ open, requireCurrent = false, onSuccess }: IProps) {
  const { mutation, isLoading } = useMutation();

  const schema = Yup.object({
    currentPassword: requireCurrent
      ? Yup.string().required('Current password is required')
      : Yup.string().optional(),
    newPassword: Yup.string().min(8, 'Min 8 characters').required('Required'),
    confirm: Yup.string()
      .oneOf([Yup.ref('newPassword')], 'Passwords must match')
      .required('Confirm your password'),
  });

  const formik = useFormik({
    initialValues: { currentPassword: '', newPassword: '', confirm: '' },
    validationSchema: schema,
    onSubmit: async (values) => {
      const body: Record<string, unknown> = { newPassword: values.newPassword };
      if (values.currentPassword) body.currentPassword = values.currentPassword;
      const res = await mutation('auth/change-password', {
        method: 'POST',
        body,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Password updated successfully');
        onSuccess();
      }
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-white p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Set a New Password</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Your account was provisioned by an administrator. Please set a private password before
              continuing.
            </p>
          </div>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-3">
          {requireCurrent && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                value={formik.values.currentPassword}
                onChange={formik.handleChange}
                className={inputCls}
              />
              {formik.touched.currentPassword && formik.errors.currentPassword && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.currentPassword}</p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">New Password</label>
            <input
              type="password"
              name="newPassword"
              value={formik.values.newPassword}
              onChange={formik.handleChange}
              placeholder="Min 8 characters"
              className={inputCls}
            />
            {formik.touched.newPassword && formik.errors.newPassword && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.newPassword}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Confirm New Password
            </label>
            <input
              type="password"
              name="confirm"
              value={formik.values.confirm}
              onChange={formik.handleChange}
              className={inputCls}
            />
            {formik.touched.confirm && formik.errors.confirm && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.confirm}</p>
            )}
          </div>

          <CustomButton
            type="submit"
            loading={isLoading}
            startIcon={<KeyRound className="h-4 w-4" />}
            className="w-full!"
          >
            Update Password
          </CustomButton>
        </form>
      </motion.div>
    </div>
  );
}

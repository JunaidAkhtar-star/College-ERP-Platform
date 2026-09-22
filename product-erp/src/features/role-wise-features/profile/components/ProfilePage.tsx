/**
 * @file ProfilePage.tsx
 * @description Self-service profile — view/update phone + emergency contact,
 *              shows immutable identity, role(s), department, account status.
 *              Backend routes: GET /user/me, PATCH /user/me
 * @module features/role-wise-features/profile
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  Building,
  Calendar,
  CheckCircle,
  XCircle,
  Save,
  Camera,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import { useAuthStore } from '@/shared/store/authStore';
import type { IAuthUser } from '@/shared/types';

interface IMeResponse {
  success?: boolean;
  data?: IAuthUser & {
    emergencyContact?: { name?: string; phone?: string; relationship?: string };
    address?: string;
    avatar?: string;
  };
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white';
const readOnlyCls =
  'w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function ProfilePage() {
  const { user, setAuth, accessToken, refreshToken, role } = useAuthStore();
  const { data: raw, isLoading, mutate } = useSwr<IMeResponse>('user/me');
  const me = raw?.data;
  const { mutation, isLoading: saving } = useMutation();
  const { mutation: avatarMutation, isLoading: uploadingAvatar } = useMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif|avif|bmp|tiff?|heic|heif)$/i.test(file.type)) {
      toast.error('Please select a supported raster image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be 2 MB or smaller');
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await avatarMutation('user/me/avatar', {
      method: 'PATCH',
      body: fd,
      isFormData: true,
    });
    const r = res as { results?: { success?: boolean; data?: IAuthUser; message?: string } };
    if (r?.results?.success) {
      toast.success('Avatar updated');
      mutate();
      const updated = r.results.data;
      if (updated && accessToken && refreshToken && role) {
        setAuth({ ...(user ?? updated), ...updated }, accessToken, refreshToken, role);
      }
      setAvatarPreview(null);
    } else {
      toast.error(r?.results?.message ?? 'Upload failed');
      setAvatarPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      phone: me?.phone ?? '',
      name: me?.name ?? '',
      bloodGroup: me?.bloodGroup ?? '',
      ecName: me?.emergencyContact?.name ?? '',
      ecPhone: me?.emergencyContact?.phone ?? '',
      ecRel: me?.emergencyContact?.relationship ?? '',
    },
    validationSchema: Yup.object({
      name: Yup.string().trim().required('Full name is required').max(255),
      phone: Yup.string()
        .matches(/^\+?[0-9\s-]{7,15}$/, 'Invalid phone number')
        .nullable(),
      ecName: Yup.string().nullable(),
      ecPhone: Yup.string()
        .matches(/^\+?[0-9\s-]{7,15}$/, 'Invalid phone number')
        .nullable(),
      ecRel: Yup.string().nullable(),
      bloodGroup: Yup.string()
        .oneOf(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
        .nullable(),
    }),
    onSubmit: async (values) => {
      const body: Record<string, unknown> = { name: values.name, bloodGroup: values.bloodGroup };
      if (values.phone) body.phone = values.phone;
      if (values.ecName || values.ecPhone || values.ecRel) {
        body.emergencyContact = {
          name: values.ecName,
          phone: values.ecPhone,
          relationship: values.ecRel,
        };
      }
      const res = await mutation('user/me', { method: 'PATCH', body });
      const ok = (res as { results?: { success?: boolean } })?.results?.success;
      if (ok) {
        toast.success('Profile updated');
        mutate();
        const updated = (res as { results?: { data?: IAuthUser } })?.results?.data;
        if (updated && accessToken && refreshToken && role) {
          setAuth({ ...(user ?? updated), ...updated }, accessToken, refreshToken, role);
        }
      } else {
        toast.error(
          (res as { results?: { message?: string } })?.results?.message ?? 'Update failed',
        );
      }
    },
  });

  useEffect(() => {
    if (me?.phone !== undefined) formik.setFieldValue('phone', me.phone ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?._id]);

  const fmtDate = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your personal contact information and emergency contact details.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl bg-white" />
          <div className="lg:col-span-2 h-72 animate-pulse rounded-2xl bg-white" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Identity card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl bg-white p-6"
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                {avatarPreview || me?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview ?? me?.avatar ?? ''}
                    alt="Avatar"
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-2xl font-bold text-primary">
                    {me?.name?.charAt(0) ?? 'U'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
                  title="Change avatar"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff,image/heic,image/heif"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              {uploadingAvatar && <p className="mt-2 text-[11px] text-slate-500">Uploading…</p>}
              <h3 className="mt-3 text-base font-semibold text-slate-900">{me?.name}</h3>
              <p className="text-xs text-slate-500">{me?.email}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                <Shield className="h-3 w-3" />
                {(me?.role ?? me?.roles?.[0] ?? '').replace('_', ' ')}
              </span>
            </div>

            <hr className="my-5 border-slate-100" />

            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-600">Email</p>
                  <p className="text-slate-700">{me?.email}</p>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] ${me?.isEmailVerified ? 'text-secondary' : 'text-amber-500'}`}
                  >
                    {me?.isEmailVerified ? (
                      <>
                        <CheckCircle className="h-2.5 w-2.5" /> Verified
                      </>
                    ) : (
                      <>
                        <XCircle className="h-2.5 w-2.5" /> Unverified
                      </>
                    )}
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Building className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                <div>
                  <p className="text-slate-700 font-medium">
                    {typeof me?.department === 'object' && me.department !== null
                      ? ((me.department as { name?: string }).name ?? '—')
                      : (me?.department ?? '—')}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-600">Member Since</p>
                  <p className="text-slate-700">{fmtDate(me?.createdAt)}</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <UserIcon className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-600">Status</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${me?.status === 'active' ? 'bg-secondary-50 text-secondary' : 'bg-red-50 text-red-500'}`}
                  >
                    {me?.status ?? 'unknown'}
                  </span>
                </div>
              </li>
            </ul>
          </motion.div>

          {/* Editable form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-2xl bg-white p-6 lg:col-span-2"
          >
            <h3 className="text-base font-semibold text-slate-900">Edit Personal Details</h3>
            <p className="mb-5 text-xs text-slate-500">
              Update your personal contact and emergency information. Email, roles and department
              remain administrator-controlled.
            </p>

            <form onSubmit={formik.handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input
                    className={inputCls}
                    placeholder="Enter your full name"
                    {...formik.getFieldProps('name')}
                  />
                  {formik.touched.name && formik.errors.name && (
                    <p className="mt-1 text-xs text-red-500">{formik.errors.name}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={readOnlyCls} value={me?.email ?? ''} readOnly />
                </div>
                <div>
                  <label className={labelCls}>
                    <Phone className="inline h-3 w-3 -mt-0.5 mr-1" />
                    Phone
                  </label>
                  <input
                    className={inputCls}
                    placeholder="+91 9876543210"
                    {...formik.getFieldProps('phone')}
                  />
                  {formik.touched.phone && formik.errors.phone && (
                    <p className="mt-1 text-xs text-red-500">{formik.errors.phone}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Blood Group</label>
                  <select className={inputCls} {...formik.getFieldProps('bloodGroup')}>
                    <option value="">Select blood group</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-800">Emergency Contact</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input
                      className={inputCls}
                      placeholder="Contact name"
                      {...formik.getFieldProps('ecName')}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input
                      className={inputCls}
                      placeholder="+91 9876543210"
                      {...formik.getFieldProps('ecPhone')}
                    />
                    {formik.touched.ecPhone && formik.errors.ecPhone && (
                      <p className="mt-1 text-xs text-red-500">{formik.errors.ecPhone}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Relationship</label>
                    <input
                      className={inputCls}
                      placeholder="Father / Spouse / Guardian"
                      {...formik.getFieldProps('ecRel')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <CustomButton
                  type="submit"
                  loading={saving}
                  startIcon={<Save className="h-4 w-4" />}
                  className="w-fit!"
                >
                  Save Changes
                </CustomButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default UseProtectedRoutes(ProfilePage);

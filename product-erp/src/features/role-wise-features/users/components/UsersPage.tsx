/**
 * @file UsersPage.tsx
 * @description Read-only directory of all system users (faculty, student,
 *   staff). Account creation now happens via dedicated wizards (e.g.
 *   `/[role]/faculty/new`). This page focuses on visibility + lifecycle
 *   actions: activate / deactivate, block / unblock, resend invite,
 *   reset password.
 * @module features/role-wise-features/users
 */
'use client';

import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  Ban,
  Building2,
  CircleGauge,
  Fingerprint,
  Eye,
  ExternalLink,
  KeyRound,
  Laptop,
  LockKeyhole,
  Mail,
  PauseCircle,
  Pencil,
  Phone,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import * as Yup from 'yup';

import AsyncSelect from '@/shared/core/AsyncSelect';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import { TSystemRole } from '@/shared/types';
import { IDirectoryUser, IUserDirectorySummary, TUserStatus } from '../types/user.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<TUserStatus, string> = {
  pending_verification: 'Pending',
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  blocked: 'Blocked',
};

const STATUS_CLS: Record<TUserStatus, string> = {
  pending_verification: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
  suspended: 'bg-orange-100 text-orange-700',
  blocked: 'bg-red-100 text-red-700',
};

const StatusBadge = ({ s }: { s: TUserStatus }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[s] ?? 'bg-slate-100 text-slate-500'}`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
    {STATUS_LABEL[s] ?? s}
  </span>
);

const getId = (u: IDirectoryUser) => u.facultyId ?? u.studentId ?? u.employeeId ?? '—';
const getDeptName = (u: IDirectoryUser) =>
  typeof u.department === 'object' && u.department !== null ? u.department.name : '—';

const formatDirectoryDate = (value?: string, includeTime = false) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return includeTime
    ? date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

type UserWorkspace = 'student' | 'faculty' | 'employee' | 'parent' | 'account';

const getUserWorkspace = (user: IDirectoryUser): UserWorkspace => {
  const roles = new Set(user.roles?.length ? user.roles : user.role ? [user.role] : []);
  if (user.studentId || roles.has('student')) return 'student';
  if (user.facultyId || roles.has('faculty') || roles.has('hod')) return 'faculty';
  if (roles.has('parent')) return 'parent';
  if (user.employeeId) return 'employee';

  // Only accounts created directly in User Management belong to its generic
  // editor. Domain-backed identities must be maintained in their source module.
  const standaloneRoles = new Set(['super_admin', 'admin']);
  return [...roles].every((role) => standaloneRoles.has(role)) ? 'account' : 'employee';
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function UsersPage() {
  const router = useRouter();
  const { tenant, role: routeRole } = useParams<{ tenant: string; role: string }>();
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const currentUserId = useAuthStore((state) => state.user?._id);
  const isSuperAdmin = activeRole === 'super_admin';
  const canCreateUser = useHasPermission('user_management', 'create');
  const canEditUsers = useHasPermission('user_management', 'edit');
  const canApproveUsers = useHasPermission('user_management', 'approve');
  const canEraseUsers = useHasPermission('user_management', 'delete');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | TUserStatus>('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<IDirectoryUser | null>(null);
  const [accessUser, setAccessUser] = useState<IDirectoryUser | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localSearch);
      setPage(0);
    }, 400);
    return () => clearTimeout(handler);
  }, [localSearch]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.append('page', String(page + 1));
    params.append('limit', String(pageSize));
    if (filterRole) params.append('role', filterRole);
    if (filterStatus) params.append('status', filterStatus);
    if (searchQuery) params.append('search', searchQuery);
    return params.toString();
  }, [page, pageSize, filterRole, filterStatus, searchQuery]);

  const { data: raw, isLoading, isValidating, mutate, pagination } = useSwr(`user?${queryString}`);
  const {
    data: summaryRaw,
    isLoading: isSummaryLoading,
    mutate: mutateSummary,
  } = useSwr('user/summary');
  const { data: rolesRaw } = useSwr('role?includeInactive=true');
  const availableRoles = useMemo(
    () =>
      (
        (
          rolesRaw as {
            data?: Array<{
              name: string;
              displayName: string;
              isSystem: boolean;
              isActive: boolean;
            }>;
          }
        )?.data ?? []
      ).filter(
        (role) => role.isSystem && role.isActive && (isSuperAdmin || role.name !== 'super_admin'),
      ),
    [isSuperAdmin, rolesRaw],
  );
  // useSwr unwraps the outer `{ success, data }` response. The user endpoint's
  // remaining shape is `{ data: User[], pagination }`; retain legacy fallbacks
  // so older deployments with one extra envelope continue to render.
  const users: IDirectoryUser[] = useMemo(() => {
    const r = raw as
      | IDirectoryUser[]
      | { data?: IDirectoryUser[] | { data?: IDirectoryUser[] } }
      | undefined;
    if (Array.isArray(r)) return r;
    const inner = r?.data;
    if (Array.isArray(inner)) return inner;
    if (Array.isArray((inner as { data?: IDirectoryUser[] } | undefined)?.data))
      return (inner as { data: IDirectoryUser[] }).data;
    return [];
  }, [raw]);
  const pageMeta = useMemo(() => {
    type PageMeta = { total?: number; page?: number; limit?: number; totalPages?: number };
    const response = raw as
      | {
          pagination?: PageMeta;
          data?: { pagination?: PageMeta; data?: { pagination?: PageMeta } };
        }
      | undefined;
    return (
      (pagination as PageMeta | undefined) ??
      response?.pagination ??
      response?.data?.pagination ??
      response?.data?.data?.pagination
    );
  }, [pagination, raw]);

  const { mutation } = useMutation();

  const openWorkspace = (user: IDirectoryUser, workspace: Exclude<UserWorkspace, 'account'>) => {
    const query = encodeURIComponent(getId(user) === '—' ? user.email : getId(user));
    const destination =
      workspace === 'student' || workspace === 'parent'
        ? 'student-management'
        : workspace === 'faculty'
          ? 'faculty-management'
          : 'hr';
    router.push(`/${tenant}/${routeRole}/${destination}?search=${query}`);
  };

  const filtered = users;

  const summary = ((summaryRaw as { data?: IUserDirectorySummary })?.data ?? summaryRaw) as
    | IUserDirectorySummary
    | undefined;

  // ─── Lifecycle action helpers ──────────────────────────────────────────────
  const setStatus = async (u: IDirectoryUser, status: TUserStatus, label: string) => {
    const result = await Swal.fire({
      title: `${label}?`,
      html: `<b>${u.name}</b> will be marked as ${label.toLowerCase()}. This change is recorded in the audit history.`,
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Reason for this change',
      inputPlaceholder: 'Enter a clear administrative or security reason…',
      inputAttributes: { maxlength: '500' },
      inputValidator: (value) =>
        value.trim().length < 3 ? 'Enter at least 3 characters explaining this change' : null,
      showCancelButton: true,
      confirmButtonText: 'Yes, proceed',
      confirmButtonColor: '#0178D7',
    });
    if (!result.isConfirmed) return;
    const res = await mutation(`user/${u._id}/status`, {
      method: 'PATCH',
      body: { status, reason: String(result.value).trim() },
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`${u.name} is now ${label.toLowerCase()}`);
      await Promise.all([mutate(), mutateSummary()]);
    }
  };

  const resetPassword = async (u: IDirectoryUser) => {
    const result = await Swal.fire({
      title: 'Reset password?',
      html: `A new temporary password will be generated for <b>${u.name}</b>.<br/><span style="font-size:12px;color:#64748b">It will be shown once after reset.</span>`,
      icon: 'warning',
      input: 'checkbox',
      inputValue: 1,
      inputPlaceholder: `Also email the credentials to ${u.email}`,
      showCancelButton: true,
      confirmButtonText: 'Generate password',
      confirmButtonColor: '#0178D7',
    });
    if (!result.isConfirmed) return;
    const sendEmail = Boolean(result.value);
    const res = await mutation(`user/${u._id}/reset-password`, {
      method: 'POST',
      body: { sendEmail },
    });
    const payload = (
      res as {
        results?: {
          success?: boolean;
          data?: {
            tempPassword?: string;
            loginId?: string;
            loginUrl?: string;
            emailRequested?: boolean;
          };
        };
      }
    )?.results;
    const credential = payload?.data;
    if (!payload?.success || !credential?.tempPassword) return;

    const portalLoginUrl = credential.loginUrl || `${window.location.origin}/login`;

    await Swal.fire({
      title: 'Temporary password generated',
      html: `
        <div style="text-align:left">
          <p style="margin:0 0 12px;color:#64748b;font-size:13px">Share these credentials securely with the user. The password is available only in this dialog.</p>
          
          <label style="display:block;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase">Institution Portal URL</label>
          <div id="reset-login-url" style="margin:4px 0 12px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1 border-slate-200;font-family:monospace;font-size:12px;font-weight:600;color:#0f172a;word-break:break-all"></div>

          <label style="display:block;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase">Login ID</label>
          <div id="reset-login-id" style="margin:4px 0 12px;padding:10px 12px;border-radius:10px;background:#f1f5f9;font-family:monospace;font-weight:700"></div>

          <label style="display:block;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase">Temporary Password</label>
          <div style="display:flex;gap:8px;margin-top:4px">
            <div id="reset-temp-password" style="flex:1;padding:10px 12px;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-family:monospace;font-weight:700"></div>
            <button id="copy-reset-password" type="button" style="border:0;border-radius:10px;background:#0178D7;color:white;padding:0 16px;font-weight:700;cursor:pointer">Copy All</button>
          </div>

          <p style="margin:12px 0 0;color:${sendEmail ? '#047857' : '#b45309'};font-size:12px">${
            sendEmail
              ? `Email delivery was requested for ${u.email} with the portal login link.`
              : 'Email was not requested. Copy and share these credentials manually.'
          }</p>
        </div>`,
      icon: 'success',
      confirmButtonText: 'I have copied it',
      confirmButtonColor: '#0178D7',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const urlEl = document.getElementById('reset-login-url');
        const loginEl = document.getElementById('reset-login-id');
        const passwordEl = document.getElementById('reset-temp-password');
        const copyBtn = document.getElementById('copy-reset-password');

        const loginIdVal = credential.loginId ?? getId(u);
        const tempPassVal = credential.tempPassword ?? '';

        if (urlEl) urlEl.textContent = portalLoginUrl;
        if (loginEl) loginEl.textContent = loginIdVal;
        if (passwordEl) passwordEl.textContent = tempPassVal;

        copyBtn?.addEventListener('click', () => {
          const formattedText = `Portal URL: ${portalLoginUrl}\nLogin ID: ${loginIdVal}\nTemporary Password: ${tempPassVal}`;
          void navigator.clipboard.writeText(formattedText);
          copyBtn.textContent = 'Copied!';
        });
      },
    });
  };

  const eraseUserData = async (u: IDirectoryUser) => {
    const result = await Swal.fire({
      title: 'Erase personal data?',
      html: `Permanently anonymises <b>${u.name}</b> (GDPR right-to-be-forgotten).<br/><br/>Name, email, phone and personal fields will be overwritten with anonymous placeholders. <span class="text-red-600">This action is irreversible.</span>`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Yes, erase',
      confirmButtonColor: '#dc2626',
      input: 'text',
      inputPlaceholder: 'Type ERASE to confirm',
      inputValidator: (v) => (v !== 'ERASE' ? 'You must type ERASE to confirm' : null),
    });
    if (!result.isConfirmed) return;
    const res = await mutation(`user/${u._id}/data`, { method: 'DELETE' });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('User data erased');
      await Promise.all([mutate(), mutateSummary()]);
    }
  };

  // ─── Columns ──────────────────────────────────────────────────────────────
  const columns: Column<IDirectoryUser>[] = [
    {
      field: 'name',
      title: 'User',
      headerClassName: 'text-left! [&>div]:justify-start!',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{row.name}</p>
            <p className="text-xs text-slate-600">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      field: 'facultyId',
      title: 'ID',
      headerClassName: 'text-center',
      cellClassName: 'text-center!',
      render: (row) => <span className="font-mono text-xs text-slate-600">{getId(row)}</span>,
    },
    {
      field: 'roles',
      title: 'Roles',
      headerClassName: 'text-center',
      cellClassName: 'text-center!',
      render: (row) => (
        <div className="flex flex-wrap justify-center gap-1">
          {(row.roles ?? []).map((r) => (
            <span
              key={r}
              className="rounded-full text-nowrap bg-primary-50 px-2 py-0.5 text-[10px] font-medium capitalize text-primary"
            >
              {r.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      ),
    },
    {
      field: 'department',
      title: 'Department',
      headerClassName: 'text-center',
      cellClassName: 'text-center!',
      render: (row) => <span className="text-sm text-slate-600">{getDeptName(row)}</span>,
    },
    {
      field: 'status',
      title: 'Status',
      headerClassName: 'text-center',
      cellClassName: 'text-center!',
      render: (row) => <StatusBadge s={row.status} />,
    },
  ];

  // ─── Actions ──────────────────────────────────────────────────────────────
  const actions: Action<IDirectoryUser>[] = [
    {
      tooltip: 'Preview access',
      icon: <Eye className="h-4 w-4 text-violet-600" />,
      onClick: setAccessUser,
      hidden: () => !canApproveUsers,
    },
    {
      tooltip: 'Suspend',
      icon: <ShieldAlert className="h-4 w-4 text-orange-600" />,
      onClick: (row) => setStatus(row, 'suspended', 'Suspend'),
      hidden: (row) => !canEditUsers || row._id === currentUserId || row.status !== 'active',
    },
    {
      tooltip: 'Edit system account',
      icon: <Pencil className="h-4 w-4 text-primary" />,
      onClick: (row) => setEditUser(row),
      hidden: (row) =>
        !canEditUsers || row._id === currentUserId || getUserWorkspace(row) !== 'account',
    },
    {
      tooltip: 'Open student profile',
      icon: <ExternalLink className="h-4 w-4 text-primary" />,
      onClick: (row) => openWorkspace(row, 'student'),
      hidden: (row) => getUserWorkspace(row) !== 'student',
    },
    {
      tooltip: 'Open faculty profile',
      icon: <ExternalLink className="h-4 w-4 text-primary" />,
      onClick: (row) => openWorkspace(row, 'faculty'),
      hidden: (row) => getUserWorkspace(row) !== 'faculty',
    },
    {
      tooltip: 'Open employee profile',
      icon: <ExternalLink className="h-4 w-4 text-primary" />,
      onClick: (row) => openWorkspace(row, 'employee'),
      hidden: (row) => getUserWorkspace(row) !== 'employee',
    },
    {
      tooltip: 'Manage parent from student profiles',
      icon: <ExternalLink className="h-4 w-4 text-primary" />,
      onClick: (row) => openWorkspace(row, 'parent'),
      hidden: (row) => getUserWorkspace(row) !== 'parent',
    },
    {
      tooltip: 'Activate',
      icon: <PlayCircle className="h-4 w-4 text-emerald-500" />,
      onClick: (row) => setStatus(row, 'active', 'Activate'),
      hidden: (row) =>
        !canEditUsers ||
        row._id === currentUserId ||
        row.status === 'active' ||
        row.status === 'pending_verification',
    },
    {
      tooltip: 'Deactivate',
      icon: <PauseCircle className="h-4 w-4 text-slate-500" />,
      onClick: (row) => setStatus(row, 'inactive', 'Deactivate'),
      hidden: (row) => !canEditUsers || row._id === currentUserId || row.status !== 'active',
    },
    {
      tooltip: 'Block',
      icon: <Ban className="h-4 w-4 text-red-500" />,
      onClick: (row) => setStatus(row, 'blocked', 'Block'),
      hidden: (row) => !canEditUsers || row._id === currentUserId || row.status === 'blocked',
    },
    {
      tooltip: 'Reset password',
      icon: <KeyRound className="h-4 w-4 text-primary" />,
      onClick: (row) => resetPassword(row),
      hidden: (row) => !canApproveUsers || row._id === currentUserId,
    },
    {
      tooltip: 'Erase personal data (GDPR)',
      icon: <Trash2 className="h-4 w-4 text-red-500" />,
      onClick: (row) => eraseUserData(row),
      hidden: (row) => !canEraseUsers || row._id === currentUserId,
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-cyan-50 p-5 sm:p-6 lg:p-7"
      >
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-100/50 blur-3xl" />

        <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                <Fingerprint className="h-3.5 w-3.5" /> Identity control center
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live directory
              </span>
            </div>

            <h1 className="mt-4 max-w-3xl text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              Govern every identity with clarity and confidence.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              One operational view for institutional accounts, effective access, security posture
              and lifecycle decisions from invitation through deactivation.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {canCreateUser && (
                <CustomButton
                  startIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setShowCreate(true)}
                  className="w-fit!"
                >
                  Add administrative account
                </CustomButton>
              )}
              <button
                type="button"
                onClick={() => void Promise.all([mutate(), mutateSummary()])}
                disabled={isValidating || isSummaryLoading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isValidating || isSummaryLoading ? 'animate-spin' : ''}`}
                />
                Refresh health
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
            className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-white/90 bg-white/75 p-4 backdrop-blur-sm sm:grid-cols-[150px_minmax(0,1fr)]"
          >
            <div className="relative mx-auto h-32 w-32 sm:h-36 sm:w-36">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img">
                <title>MFA adoption across visible accounts</title>
                <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" strokeWidth="9" />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="9"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray="100"
                  initial={{ strokeDashoffset: 100 }}
                  animate={{ strokeDashoffset: 100 - (summary?.mfaAdoptionPercent ?? 0) }}
                  transition={{ duration: 1, delay: 0.25, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-900">
                  {isSummaryLoading ? '—' : `${summary?.mfaAdoptionPercent ?? 0}%`}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  MFA adoption
                </span>
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Directory coverage
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {isSummaryLoading ? '—' : (summary?.total ?? 0).toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-slate-500">accounts in your permitted scope</p>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-start gap-2">
                <ShieldAlert
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    (summary?.blocked ?? 0) + (summary?.suspended ?? 0) > 0
                      ? 'text-red-500'
                      : 'text-emerald-500'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {(summary?.blocked ?? 0) + (summary?.suspended ?? 0)} restricted
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Blocked and suspended accounts requiring review.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Global, server-computed directory health */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: 'Total',
            value: summary?.total,
            hint: 'Visible accounts',
            color: 'bg-primary-50 text-primary',
            icon: <Users className="h-4 w-4" />,
          },
          {
            label: 'Active',
            value: summary?.active,
            hint: 'Can access ERP',
            color: 'bg-emerald-50 text-emerald-600',
            icon: <UserCheck className="h-4 w-4" />,
          },
          {
            label: 'Pending',
            value: summary?.pending,
            hint: 'Awaiting activation',
            color: 'bg-amber-50 text-amber-600',
            icon: <ShieldCheck className="h-4 w-4" />,
          },
          {
            label: 'Restricted',
            value: summary ? summary.blocked + summary.suspended : undefined,
            hint: `${summary?.blocked ?? 0} blocked · ${summary?.suspended ?? 0} suspended`,
            color: 'bg-red-50 text-red-600',
            icon: <Ban className="h-4 w-4" />,
          },
          {
            label: 'Dormant',
            value: summary?.dormant,
            hint: 'No sign-in in 30 days',
            color: 'bg-orange-50 text-orange-600',
            icon: <CircleGauge className="h-4 w-4" />,
          },
          {
            label: 'Unassigned',
            value: summary?.withoutDepartment,
            hint: 'Without department',
            color: 'bg-violet-50 text-violet-600',
            icon: <Building2 className="h-4 w-4" />,
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3, borderColor: '#bfdbfe' }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">
                {isSummaryLoading || s.value === undefined ? '—' : s.value}
              </p>
              <p className="text-xs font-semibold text-slate-700">{s.label}</p>
              <p className="truncate text-[10px] text-slate-500">{s.hint}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4">
        <select
          value={filterRole}
          onChange={(e) => {
            setFilterRole(e.target.value);
            setPage(0);
          }}
          className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Roles</option>
          {availableRoles.map((role) => (
            <option key={role.name} value={role.name}>
              {role.displayName}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as TUserStatus | '');
            setPage(0);
          }}
          className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Status</option>
          {(Object.keys(STATUS_LABEL) as TUserStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-60 max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by name, email, employee ID..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                setSearchQuery('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {canCreateUser && (
          <CustomButton
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowCreate(true)}
          >
            Add account
          </CustomButton>
        )}
      </div>

      {/* List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <DataViewSwitcher<IDirectoryUser>
          data={filtered}
          isLoading={isLoading}
          storageKey="users.view"
          searchPlaceholder="Search users…"
          searchFields={['name', 'email', 'facultyId', 'studentId', 'phone']}
          renderCard={(u) => (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <StatusBadge s={u.status} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                <p className="font-mono text-[10px] text-slate-600">{getId(u)}</p>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-slate-600" />
                  <span className="truncate">{u.email}</span>
                </p>
                {u.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-slate-600" />
                    <span>{u.phone}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {(u.roles ?? []).map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium capitalize text-primary"
                  >
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
          table={
            <div className="overflow-hidden rounded-2xl bg-white">
              <CustomTable
                title="User Directory"
                description="All accounts created through onboarding wizards. Manage status, block, or reset passwords."
                onRefresh={() => Promise.all([mutate(), mutateSummary()])}
                isRefreshing={isValidating}
                data={filtered as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                actions={actions as unknown as Action<Record<string, unknown>>[]}
                isLoading={isLoading || isValidating}
                page={page}
                pageSize={pageSize}
                totalCount={pageMeta?.total ?? filtered.length}
                onPageChange={setPage}
                onRowsPerPageChange={(size) => {
                  setPageSize(size);
                  setPage(0);
                }}
                options={{
                  search: false,
                  pagination: true,
                  pageSize: pageSize,
                  actionsType: 'dropdown',
                  detailPanel: true,
                  detailPanelPosition: 'right',
                  export: false,
                }}
                detailPanel={(record) => {
                  const row = record as unknown as IDirectoryUser;
                  const workspace = getUserWorkspace(row);
                  return (
                    <div className="rounded-xl bg-slate-50/70 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800">Account details</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Identity source, contact and account lifecycle information.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold capitalize text-primary">
                          {workspace === 'account'
                            ? 'Administrative account'
                            : `${workspace} profile`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                        {[
                          { label: 'Phone', value: row.phone || 'Not provided' },
                          { label: 'Joined', value: formatDirectoryDate(row.createdAt) },
                          {
                            label: 'Last updated',
                            value: formatDirectoryDate(row.updatedAt || row.createdAt, true),
                          },
                          {
                            label: 'Email verification',
                            value: row.isEmailVerified ? 'Verified' : 'Pending verification',
                          },
                          { label: 'Department', value: getDeptName(row) },
                          { label: 'System record ID', value: row._id, mono: true },
                        ].map((item) => (
                          <div key={item.label} className="min-w-0 rounded-xl bg-white p-3">
                            <p className="font-semibold uppercase tracking-wider text-slate-500">
                              {item.label}
                            </p>
                            <p
                              className={`mt-1 truncate font-medium text-slate-800 ${
                                item.mono ? 'font-mono text-[11px]' : ''
                              }`}
                              title={item.value}
                            >
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          }
        />
      </motion.div>

      <AnimatePresence>
        {showCreate && (
          <UserFormModal
            mode="create"
            onClose={() => setShowCreate(false)}
            onSaved={() => {
              setShowCreate(false);
              void Promise.all([mutate(), mutateSummary()]);
            }}
          />
        )}
        {editUser && (
          <UserFormModal
            mode="edit"
            user={editUser}
            onClose={() => setEditUser(null)}
            onSaved={() => {
              setEditUser(null);
              void Promise.all([mutate(), mutateSummary()]);
            }}
          />
        )}
        {accessUser && (
          <AccessPreview
            user={accessUser}
            onClose={() => setAccessUser(null)}
            onChanged={() => mutate()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface IAccessDetail {
  user: IDirectoryUser & {
    lastLogin?: string;
    mfaEnabled?: boolean;
  };
  customRoles: Array<{ _id: string; displayName: string; baseRole: string }>;
  effectivePermissions: Array<{ module: string; actions: string[] }>;
  sessions: Array<{ device: string; ip: string; createdAt: string }>;
}

function AccessPreview({
  user,
  onClose,
  onChanged,
}: {
  user: IDirectoryUser;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: raw, isLoading, mutate } = useSwr(`user/${user._id}/access`);
  const detail = (raw as { data?: IAccessDetail })?.data;
  const { mutation, isLoading: processing } = useMutation();

  const revokeSessions = async () => {
    const confirmation = await Swal.fire({
      title: 'Sign out every device?',
      text: `${user.name} will need to sign in again on all devices.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Revoke sessions',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation(`user/${user._id}/revoke-sessions`, {
      method: 'POST',
      body: {},
    });
    if (!response?.results?.success) return;
    toast.success('All sessions revoked');
    await mutate();
    onChanged();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-slate-200/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 50 }}
        animate={{ x: 0 }}
        exit={{ x: 50 }}
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 p-5"
        aria-label="User access preview"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Effective access preview
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950">{user.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-white p-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading || !detail ? (
          <div className="mt-5 h-52 animate-pulse rounded-2xl bg-white" />
        ) : (
          <div className="mt-5 space-y-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <AccessStat
                label="Account"
                value={STATUS_LABEL[detail.user.status]}
                hint={detail.user.isEmailVerified ? 'Email verified' : 'Verification pending'}
              />
              <AccessStat
                label="Password"
                value={detail.user.mustChangePassword ? 'Change required' : 'Configured'}
                hint={detail.user.mfaEnabled ? 'MFA enabled' : 'MFA not enabled'}
              />
              <AccessStat
                label="Last sign-in"
                value={
                  detail.user.lastLogin
                    ? new Date(detail.user.lastLogin).toLocaleDateString('en-IN')
                    : 'Never'
                }
                hint={`${detail.sessions.length} active session${detail.sessions.length === 1 ? '' : 's'}`}
              />
            </section>

            <section className="rounded-2xl bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <ShieldCheck className="h-4 w-4 text-primary" /> Assigned roles
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.user.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold capitalize text-primary"
                  >
                    {role.replace(/_/g, ' ')}
                  </span>
                ))}
                {detail.customRoles.map((role) => (
                  <span
                    key={role._id}
                    className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"
                  >
                    {role.displayName}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <LockKeyhole className="h-4 w-4 text-primary" /> Effective custom permissions
              </h3>
              {detail.effectivePermissions.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {detail.effectivePermissions.map((permission) => (
                    <div key={permission.module} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold capitalize text-slate-700">
                        {permission.module.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {permission.actions.join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No custom permission role"
                  subTitle="Access currently follows the assigned system role and its governed defaults."
                />
              )}
            </section>

            <section className="rounded-2xl bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Laptop className="h-4 w-4 text-primary" /> Active sessions
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Revoke sessions after a role change or suspected account compromise.
                  </p>
                </div>
                {detail.sessions.length > 0 && (
                  <CustomButton
                    variant="cancel"
                    onClick={revokeSessions}
                    loading={processing}
                    className="w-fit!"
                  >
                    Revoke all
                  </CustomButton>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {detail.sessions.map((session, index) => (
                  <div
                    key={`${session.createdAt}-${index}`}
                    className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"
                  >
                    <p className="font-bold text-slate-700">{session.device || 'Unknown device'}</p>
                    <p className="mt-1">
                      {session.ip || 'IP unavailable'} ·{' '}
                      {new Date(session.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
                {!detail.sessions.length && (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No active sessions.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}

function AccessStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────
interface IFormProps {
  mode: 'create' | 'edit';
  user?: IDirectoryUser;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ mode, user, onClose, onSaved }: IFormProps) {
  const { mutation, isLoading } = useMutation();

  const initialDept =
    typeof user?.department === 'object' && user?.department !== null
      ? user.department._id
      : ((user?.department as string | undefined) ?? '');

  const formik = useFormik({
    initialValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      roles: (user?.roles ?? []) as TSystemRole[],
      department: initialDept,
    },
    enableReinitialize: true,
    validationSchema:
      mode === 'create'
        ? Yup.object({
            name: Yup.string().trim().required('Name is required'),
            email: Yup.string().email('Invalid email').required('Email is required'),
            roles: Yup.array().of(Yup.string()).min(1, 'Pick at least one role'),
          })
        : Yup.object({
            name: Yup.string().trim().required('Name is required'),
            roles: Yup.array().of(Yup.string()).min(1, 'Pick at least one role'),
          }),
    onSubmit: async (values) => {
      if (mode === 'create') {
        const body: Record<string, unknown> = {
          name: values.name.trim(),
          email: values.email.trim(),
          roles: values.roles,
        };
        if (values.phone.trim()) body.phone = values.phone.trim();
        if (values.department) body.department = values.department;
        const res = await mutation('user', { method: 'POST', body });
        if ((res as { results?: { success?: boolean } })?.results?.success) {
          toast.success('User created');
          onSaved();
        }
      } else if (user) {
        const body: Record<string, unknown> = {
          name: values.name.trim(),
          roles: values.roles,
        };
        if (values.phone.trim()) body.phone = values.phone.trim();
        if (values.department) body.department = values.department;
        const res = await mutation(`user/${user._id}`, { method: 'PATCH', body });
        if ((res as { results?: { success?: boolean } })?.results?.success) {
          toast.success('User updated');
          onSaved();
        }
      }
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'create' ? 'Create User' : 'Edit User'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'create'
                ? 'Provision a new system account.'
                : `Update profile for ${user?.name}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <p className="font-semibold">How account setup works</p>
              <p className="mt-1 text-xs text-blue-700">
                This form creates standalone administrative system accounts only. Create Students
                through Admissions, Faculty through Faculty Onboarding, employees through Employee
                Management, and Parents through the student-parent linking workflow.
              </p>
            </div>

            <section className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Account identity</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Basic contact information used for account activation and communication.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Name *</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none"
                    {...formik.getFieldProps('name')}
                  />
                  {formik.touched.name && formik.errors.name && (
                    <p className="mt-1 text-xs text-red-500">{formik.errors.name}</p>
                  )}
                </div>

                {mode === 'create' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
                    <input
                      type="email"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none"
                      {...formik.getFieldProps('email')}
                    />
                    {formik.touched.email && formik.errors.email && (
                      <p className="mt-1 text-xs text-red-500">{formik.errors.email}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                  <input
                    type="tel"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none"
                    {...formik.getFieldProps('phone')}
                  />
                </div>
              </div>
              {mode === 'create' && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  A secure activation link is emailed to the user. They verify the address and
                  choose their password; passwords are never displayed or stored as plain text.
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-100 p-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Organization &amp; access</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Department scopes institutional data; roles combine to form the user’s effective
                  permissions.
                </p>
              </div>
              <div>
                <AsyncSelect
                  label="Department"
                  type="departments"
                  placeholder="Select department (optional)"
                  value={formik.values.department || null}
                  onChange={(v) => formik.setFieldValue('department', v ?? '')}
                />
              </div>

              <div>
                <AsyncSelect
                  label="Roles"
                  type="roles"
                  multiple
                  required
                  params={
                    mode === 'create'
                      ? { standaloneOnly: true, onboardingContractVersion: 3 }
                      : undefined
                  }
                  value={formik.values.roles}
                  onChange={(roles) => formik.setFieldValue('roles', roles as TSystemRole[])}
                  placeholder={
                    mode === 'create'
                      ? 'Select an administrative or operational role'
                      : 'Select one or more roles'
                  }
                  emptyMessage="No standalone administrative roles are available."
                  error={
                    formik.touched.roles && formik.errors.roles
                      ? String(formik.errors.roles)
                      : undefined
                  }
                />
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Student, Parent, Faculty and HOD accounts use their profile-aware onboarding
                  workflows. Administrative and non-teaching roles can be created here and linked to
                  an employment record from Employee Management when required.
                </p>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              {mode === 'create' ? 'Create' : 'Save Changes'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

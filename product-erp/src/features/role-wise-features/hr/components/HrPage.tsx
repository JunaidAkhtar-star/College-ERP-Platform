/**
 * @file HrPage.tsx
 * @description HR Employee management — CRUD for hr/employees, view own record via hr/me.
 * @module features/role-wise-features/hr
 */
'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Briefcase, Users, UserCheck, Plus, Edit2, Trash2, Eye, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Swal from 'sweetalert2';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import AsyncSelect from '@/shared/core/AsyncSelect';
import FacultyHrWorkflowBar from '@/shared/components/FacultyHrWorkflowBar';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';

import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';

type TEmploymentType = 'permanent' | 'contractual' | 'visiting' | 'adhoc' | 'guest_faculty';
type TEmploymentStatus = 'active' | 'resigned' | 'terminated' | 'retired' | 'on_leave';

interface IHrEmployee {
  _id: string;
  userId?: string | { _id?: string };
  department?: string | { _id?: string; name?: string };
  employeeId?: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  designation?: string;
  departmentName?: string;
  employmentType: TEmploymentType;
  employmentStatus: TEmploymentStatus;
  dateOfJoining?: string;
  basicSalary?: number;
  [key: string]: unknown;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const STATUS_CFG: Record<TEmploymentStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-green-50', text: 'text-green-600' },
  on_leave: { label: 'On Leave', bg: 'bg-amber-50', text: 'text-amber-600' },
  resigned: { label: 'Resigned', bg: 'bg-slate-100', text: 'text-slate-500' },
  terminated: { label: 'Terminated', bg: 'bg-red-50', text: 'text-red-500' },
  retired: { label: 'Retired', bg: 'bg-purple-50', text: 'text-purple-600' },
};

const schema = Yup.object({
  userId: Yup.string().required('Select a linked user account'),
  department: Yup.string().required('Select a department'),
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string().required('Phone is required'),
  gender: Yup.string().oneOf(['male', 'female', 'other']).required('Required'),
  designation: Yup.string().required('Designation is required'),
  employmentType: Yup.string().required('Employment type is required'),
  dateOfJoining: Yup.string().required('Date of joining is required'),
  basicSalary: Yup.number().min(0).required('Basic salary is required'),
});

const entityId = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value)
    return String((value as { _id?: unknown })._id ?? '');
  return '';
};

function EmployeeModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: IHrEmployee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      userId: entityId(employee?.userId),
      department: entityId(employee?.department),
      name: employee?.name ?? '',
      email: employee?.email ?? '',
      phone: employee?.phone ?? '',
      gender: employee?.gender ?? 'male',
      designation: employee?.designation ?? '',
      employmentType: employee?.employmentType ?? 'permanent',
      dateOfJoining: employee?.dateOfJoining ? employee.dateOfJoining.slice(0, 10) : '',
      basicSalary: employee?.basicSalary ?? 0,
    },
    validationSchema: schema,
    onSubmit: async (values) => {
      const path = employee ? `hr/employees/${employee._id}` : 'hr/employees';
      const method = (employee ? 'PUT' : 'POST') as 'PUT' | 'POST';
      const res = await mutation(path, { method, body: values, isAlert: true });
      if (res) {
        onSaved();
        onClose();
      }
    },
  });

  const err = (k: keyof typeof formik.errors) =>
    formik.touched[k] && formik.errors[k] ? String(formik.errors[k]) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6"
      >
        <h2 className="mb-5 text-lg font-semibold text-slate-900">
          {employee ? 'Edit Employment Record' : 'Add Non-Teaching Staff'}
        </h2>
        <form onSubmit={formik.handleSubmit} className="grid grid-cols-2 gap-4">
          {!employee && (
            <div className="col-span-2">
              <AsyncSelect
                type="users"
                label="Linked User Account"
                required
                value={formik.values.userId}
                onChange={(value) => formik.setFieldValue('userId', value ?? '')}
                placeholder="Search an existing staff user"
                error={formik.touched.userId ? formik.errors.userId : undefined}
              />
              <p className="mt-1 text-xs text-slate-600">
                Choose the login account this employment record belongs to.
              </p>
            </div>
          )}
          <div className="col-span-2">
            <AsyncSelect
              type="departments"
              label="Department"
              required
              value={formik.values.department}
              onChange={(value) => formik.setFieldValue('department', value ?? '')}
              placeholder="Search department"
              error={formik.touched.department ? formik.errors.department : undefined}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Full Name *</label>
            <input
              className={inputCls}
              {...formik.getFieldProps('name')}
              placeholder="Dr. Ravi Kumar"
            />
            {err('name') && <p className="mt-1 text-xs text-red-500">{err('name')}</p>}
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input className={inputCls} type="email" {...formik.getFieldProps('email')} />
            {err('email') && <p className="mt-1 text-xs text-red-500">{err('email')}</p>}
          </div>
          <div>
            <label className={labelCls}>Phone *</label>
            <input className={inputCls} {...formik.getFieldProps('phone')} />
            {err('phone') && <p className="mt-1 text-xs text-red-500">{err('phone')}</p>}
          </div>
          <div>
            <label className={labelCls}>Gender *</label>
            <select className={inputCls} {...formik.getFieldProps('gender')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Designation *</label>
            <input
              className={inputCls}
              {...formik.getFieldProps('designation')}
              placeholder="Assistant Professor"
            />
            {err('designation') && (
              <p className="mt-1 text-xs text-red-500">{err('designation')}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Employment Type *</label>
            <select className={inputCls} {...formik.getFieldProps('employmentType')}>
              <option value="permanent">Permanent</option>
              <option value="contractual">Contractual</option>
              <option value="visiting">Visiting</option>
              <option value="adhoc">Ad hoc</option>
              <option value="guest_faculty">Guest Faculty</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Date of Joining *</label>
            <input className={inputCls} type="date" {...formik.getFieldProps('dateOfJoining')} />
            {err('dateOfJoining') && (
              <p className="mt-1 text-xs text-red-500">{err('dateOfJoining')}</p>
            )}
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Basic Salary (Rs.) *</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              {...formik.getFieldProps('basicSalary')}
            />
            {err('basicSalary') && (
              <p className="mt-1 text-xs text-red-500">{err('basicSalary')}</p>
            )}
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-1">
            <CustomButton variant="cancel" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              {employee ? 'Update Record' : 'Add Staff Member'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function HrPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const hasViewPermission = useHasPermission('employee', 'view');
  const hasCreatePermission = useHasPermission('employee', 'create');
  const hasEditPermission = useHasPermission('employee', 'edit');
  const hasDeletePermission = useHasPermission('employee', 'delete');
  const canUseHr = Boolean(activeRole && !['student', 'parent'].includes(activeRole));
  const canViewAll = hasViewPermission;
  const canCreate = hasCreatePermission;
  const canEdit = hasEditPermission;
  const canTerminate = hasDeletePermission;
  const router = useRouter();
  const { tenant, role } = useParams<{ tenant: string; role: string }>();
  const searchParams = useSearchParams();

  const [filterStatus, setFilterStatus] = useState(
    searchParams.get('employmentStatus') ?? searchParams.get('status') ?? '',
  );
  const [filterType, setFilterType] = useState('');
  const initialSearch = searchParams.get('search') ?? '';
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<IHrEmployee | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  const handleFilterStatus = (v: string) => {
    setFilterStatus(v);
    setPage(1);
  };
  const handleFilterType = (v: string) => {
    setFilterType(v);
    setPage(1);
  };
  const handleSearch = (v: string) => {
    setSearch(v);
  };

  const apiUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (filterStatus) q.set('status', filterStatus);
    if (filterType) q.set('type', filterType);
    if (debouncedSearch) q.set('search', debouncedSearch);
    return `hr/employees?${q.toString()}`;
  }, [page, filterStatus, filterType, debouncedSearch]);

  const { data: raw, error: listError, isLoading, mutate } = useSwr(canViewAll ? apiUrl : null);
  const {
    data: meRaw,
    error: meError,
    isLoading: meLoading,
    mutate: mutateMe,
  } = useSwr(canUseHr && !canViewAll ? 'hr/me' : null);
  const { mutation } = useMutation();

  const records: IHrEmployee[] = useMemo(
    () =>
      (raw as { data?: { data?: IHrEmployee[] } })?.data?.data ??
      (raw as { data?: IHrEmployee[] })?.data ??
      [],
    [raw],
  );
  const totalCount = useMemo(
    () => (raw as { data?: { total?: number } })?.data?.total ?? records.length,
    [raw, records],
  );
  const me = (meRaw as { data?: IHrEmployee })?.data;
  const meMissing = meError instanceof Error && /employee record not found/i.test(meError.message);

  const summary = (
    raw as {
      data?: { summary?: { total?: number; active?: number; permanent?: number } };
    }
  )?.data?.summary;
  const activeCount = summary?.active ?? 0;
  const permanentCount = summary?.permanent ?? 0;

  const handleTerminate = async (row: IHrEmployee) => {
    const result = await Swal.fire({
      title: 'Terminate Employee?',
      text: `${row.name} will be marked as terminated.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Terminate',
      confirmButtonColor: '#0178D7',
    });
    if (result.isConfirmed) {
      const res = await mutation(`hr/employees/${row._id}`, { method: 'DELETE', isAlert: true });
      if (res) mutate();
    }
  };

  const columns: Column<IHrEmployee>[] = [
    {
      field: 'name',
      title: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
            {row.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{row.name}</p>
            <p className="text-xs text-slate-600">{row.employeeId ?? ''}</p>
          </div>
        </div>
      ),
    },
    {
      field: 'email',
      title: 'Email',
      render: (row) => <span className="text-sm text-slate-600">{row.email}</span>,
    },
    {
      field: 'designation',
      title: 'Designation',
      render: (row) => <span className="text-sm text-slate-700">{row.designation ?? '—'}</span>,
    },
    {
      field: 'employmentType',
      title: 'Type',
      render: (row) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 capitalize">
          {row.employmentType.replace('_', ' ')}
        </span>
      ),
    },
    {
      field: 'employmentStatus',
      title: 'Status',
      render: (row) => {
        const c = STATUS_CFG[row.employmentStatus] ?? STATUS_CFG.active;
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
            {c.label}
          </span>
        );
      },
    },
    {
      field: 'dateOfJoining',
      title: 'Joined',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.dateOfJoining
            ? new Date(row.dateOfJoining).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
  ];

  const actions: Action<IHrEmployee>[] = canViewAll
    ? [
        {
          tooltip: 'View',
          icon: <Eye className="h-3.5 w-3.5" />,
          onClick: (row) => setViewId(row._id),
        },
        ...(canEdit
          ? [
              {
                tooltip: 'Edit',
                icon: <Edit2 className="h-3.5 w-3.5" />,
                onClick: (row: IHrEmployee) => {
                  setEditRecord(row);
                  setModalOpen(true);
                },
              },
            ]
          : []),
        ...(canTerminate
          ? [
              {
                tooltip: 'Terminate',
                icon: <Trash2 className="h-3.5 w-3.5" />,
                onClick: handleTerminate,
                hidden: (row: IHrEmployee) => row.employmentStatus !== 'active',
              },
            ]
          : []),
      ]
    : [];

  if (!canUseHr) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-slate-900">HR access unavailable</h1>
        <p className="mt-1 text-sm text-slate-600">
          The active role is not authorized for employee HR records.
        </p>
      </div>
    );
  }

  if (!canViewAll) {
    return (
      <div className="space-y-5">
        <FacultyHrWorkflowBar />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My HR Profile</h1>
          <p className="mt-1 text-sm text-slate-500">Your employment details</p>
        </div>
        {meLoading ? (
          <div className="h-56 animate-pulse rounded-2xl border border-slate-100 bg-white" />
        ) : meError && !meMissing ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
            <div>
              <p className="font-semibold text-red-800">Your HR profile could not be loaded</p>
              <p className="text-sm text-red-700">Check your connection or contact HR.</p>
            </div>
            <CustomButton variant="tertiary" type="button" onClick={() => mutateMe()}>
              Retry
            </CustomButton>
          </div>
        ) : me ? (
          <div className="rounded-2xl bg-white p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-2xl font-bold text-primary">
                {me.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{me.name}</h2>
                <p className="text-sm text-slate-500">
                  {me.designation ?? ''} {me.departmentName ?? ''}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Employee ID', value: me.employeeId ?? '—' },
                { label: 'Email', value: me.email },
                { label: 'Phone', value: me.phone ?? '—' },
                { label: 'Type', value: me.employmentType?.replace('_', ' ') ?? '—' },
                { label: 'Status', value: me.employmentStatus?.replace('_', ' ') ?? '—' },
                {
                  label: 'Joined',
                  value: me.dateOfJoining
                    ? new Date(me.dateOfJoining).toLocaleDateString('en-IN')
                    : '—',
                },
              ].map((f) => (
                <div key={f.label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">{f.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800 capitalize">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16">
            <Briefcase className="h-10 w-10 text-slate-200 mb-2" />
            <p className="text-sm text-slate-600">No HR record found</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FacultyHrWorkflowBar />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Employees',
            value: totalCount,
            icon: <Users className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
          {
            label: 'Active',
            value: activeCount,
            icon: <UserCheck className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Permanent',
            value: permanentCount,
            icon: <Briefcase className="h-4.5 w-4.5" />,
            color: 'bg-secondary-50 text-secondary',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-xl bg-white p-4"
          >
            <div
              className={
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ' + s.color
              }
            >
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Filter Controls Section ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4  grid grid-cols-1 gap-4 sm:grid-cols-4 items-end">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Search
          </label>
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search name, email..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => handleFilterStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Employment Type
          </label>
          <select
            value={filterType}
            onChange={(e) => handleFilterType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
          >
            <option value="">All Types</option>
            <option value="permanent">Permanent</option>
            <option value="contractual">Contractual</option>
            <option value="visiting">Visiting</option>
            <option value="adhoc">Ad hoc</option>
            <option value="guest_faculty">Guest Faculty</option>
          </select>
        </div>
        <div className="flex items-end justify-between gap-2">
          {(filterStatus || filterType || search) && (
            <button
              type="button"
              onClick={() => {
                handleFilterStatus('');
                handleFilterType('');
                handleSearch('');
              }}
              className="text-xs text-slate-600 hover:text-slate-600 underline h-9 flex items-center"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowInfoDialog(true)}
            title="Employee type guide"
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition"
          >
            <Info className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      {listError && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
          <div>
            <p className="font-semibold text-red-800">Employee records could not be loaded</p>
            <p className="text-sm text-red-700">Check your connection or access, then retry.</p>
          </div>
          <CustomButton variant="tertiary" type="button" onClick={() => mutate()}>
            Retry
          </CustomButton>
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <CustomTable<IHrEmployee>
          title="Employment Records"
          description="HR details for teaching and non-teaching employees"
          onRefresh={() => mutate()}
          isRefreshing={isLoading}
          data={records}
          columns={columns}
          actions={actions}
          isLoading={isLoading}
          page={page}
          totalCount={totalCount}
          pageSize={15}
          onPageChange={setPage}
          options={{
            search: false,
            pagination: true,
            pageSize: 15,
            actionsType: 'dropdown',
            export: false,
          }}
          customActions={
            canCreate ? (
              <div className="flex items-center gap-2 whitespace-nowrap">
                <CustomButton
                  variant="secondary"
                  startIcon={<UserCheck className="h-4 w-4" />}
                  onClick={() => router.push(`/${tenant}/${role}/faculty-management/onboard`)}
                  className="whitespace-nowrap"
                >
                  Onboard Teaching Faculty
                </CustomButton>
                <CustomButton
                  startIcon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    setEditRecord(null);
                    setModalOpen(true);
                  }}
                  className="whitespace-nowrap"
                >
                  Add Non-Teaching Staff
                </CustomButton>
              </div>
            ) : undefined
          }
        />
      </motion.div>

      <AnimatePresence>
        {showInfoDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowInfoDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-md rounded-2xl bg-white  border border-slate-100 pointer-events-auto">
                <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <Info className="h-4.5 w-4.5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Employee Type Guide</h3>
                    <p className="text-xs text-slate-600">
                      How to add different types of employees
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInfoDialog(false)}
                    className="ml-auto rounded-lg p-1 text-slate-600 hover:bg-slate-50 hover:text-slate-700 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                    <p className="text-sm font-semibold text-slate-800">👨‍🏫 Teaching Employee</p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      Use <strong>Faculty Onboarding</strong>. It creates the login account and
                      captures employment, qualification and academic-profile details in one guided
                      flow.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                    <p className="text-sm font-semibold text-slate-800">🏢 Non-Teaching Employee</p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      Use <strong>Add Non-Teaching Staff</strong> for administration, accounts,
                      library, support and other staff employment records.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
                  <CustomButton variant="cancel" onClick={() => setShowInfoDialog(false)}>
                    Close
                  </CustomButton>
                </div>
              </div>
            </motion.div>
          </>
        )}
        {modalOpen && (
          <EmployeeModal
            employee={editRecord}
            onClose={() => {
              setModalOpen(false);
              setEditRecord(null);
            }}
            onSaved={() => mutate()}
          />
        )}
        {viewId && <EmployeeDetailDrawer employeeId={viewId} onClose={() => setViewId(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Employee Detail Drawer ─────────────────────────────────────────────────────
function EmployeeDetailDrawer({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const { data, error, isLoading, mutate } = useSwr<{ data?: IHrEmployee }>(
    `hr/employees/${employeeId}`,
  );
  const emp = data?.data;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="relative z-10 h-dvh w-full max-w-md overflow-y-auto bg-white p-6"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-600 hover:bg-slate-100"
        >
          ✕
        </button>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Employee Details</h2>
        {isLoading && <div className="h-32 animate-pulse rounded-xl bg-slate-50" />}
        {!isLoading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">
              Employee details could not be loaded
            </p>
            <CustomButton
              className="mt-3"
              variant="tertiary"
              type="button"
              onClick={() => mutate()}
            >
              Retry
            </CustomButton>
          </div>
        )}
        {!isLoading && emp && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-base font-semibold text-slate-800">{emp.name}</p>
              <p className="text-xs text-primary">{emp.designation ?? '—'}</p>
              <p className="text-xs text-slate-500 mt-1">
                {emp.email ?? '—'} · {emp.phone ?? '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Detail label="Employee ID" value={String(emp.employeeId ?? '—')} />
              <Detail label="Department" value={String(emp.departmentName ?? '—')} />
              <Detail label="Type" value={String(emp.employmentType ?? '—')} />
              <Detail label="Status" value={emp.employmentStatus} />
              <Detail
                label="Joining Date"
                value={
                  emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN') : '—'
                }
              />
              <Detail label="PAN" value={String(emp.panNumber ?? '—')} />
              <Detail label="Aadhar" value={String(emp.aadharNumber ?? '—')} />
              <Detail label="Blood Group" value={String(emp.bloodGroup ?? '—')} />
            </div>
            {Boolean(emp.address) && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase text-slate-600">Address</p>
                <p className="text-xs text-slate-700">{String(emp.address)}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <p className="text-[10px] uppercase text-slate-600">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Users,
  GraduationCap,
  CheckCircle,
  Mail,
  Phone,
  MapPin,
  UploadCloud,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CrudButton from '@/shared/core/CrudButton';
import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';

import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasAnyRole } from '@/shared/hooks/useHasRole';
import type { IDepartment } from '../types/departments.types';
import DepartmentModal from './DepartmentModal';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import CustomButton from '@/shared/core/CustomButton';
import ImportMigrationDialog from '../../import-center/components/ImportMigrationDialog';

export default function DepartmentsPage() {
  const canManage = useHasAnyRole(['super_admin', 'dean_academic']);
  const canDeactivate = useHasAnyRole(['super_admin']);
  const canCreateDepartment = useHasPermission('department', 'create');
  const canStageImport = useHasPermission('import_center', 'create');
  const canImport = canCreateDepartment && canStageImport;
  const [showImport, setShowImport] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IDepartment | null>(null);

  const { data: raw, isLoading, isValidating, mutate } = useSwr('department');
  const departments: IDepartment[] = (raw as { data?: IDepartment[] })?.data ?? [];
  const { mutation, isLoading: saving } = useMutation();

  const active = departments.filter((d) => d.status === 'Active').length;
  const totalIntake = departments.reduce((s, d) => s + (d.intake ?? 0), 0);
  const offeredProgramTypes = [...new Set(departments.flatMap((d) => d.programs ?? []))].length;

  const handleDelete = async (row: IDepartment) => {
    const res = await Swal.fire({
      title: `Deactivate "${row.name}"?`,
      text: 'Department will be marked Inactive.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0178D7',
      confirmButtonText: 'Yes, deactivate',
    });
    if (!res.isConfirmed) return;
    const r = await mutation(`department/${row._id}`, { method: 'DELETE' });
    if ((r as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Department deactivated');
      mutate();
    } else toast.error('Failed to deactivate');
  };

  const handleSave = async (values: Partial<IDepartment>) => {
    const r = await mutation(editing ? `department/${editing._id}` : 'department', {
      method: editing ? 'PUT' : 'POST',
      body: values,
    });
    if ((r as { results?: { success?: boolean } })?.results?.success) {
      toast.success(editing ? 'Updated' : 'Created');
      mutate();
      setModalOpen(false);
      setEditing(null);
    } else toast.error('Failed');
  };

  const columns: Column<IDepartment>[] = [
    {
      field: 'code',
      title: 'Code',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="rounded-lg text-nowrap bg-primary-50 px-2.5 py-1 font-mono text-xs font-bold text-primary">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      field: 'name',
      title: 'Department',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-600">{row.shortName}</p>
        </div>
      ),
    },
    {
      field: 'hodName',
      title: 'HoD',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm text-nowrap text-slate-600">{row.hodName ?? '—'}</span>
        </div>
      ),
    },
    {
      field: 'programs',
      title: 'Offered Programs',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex flex-wrap justify-center gap-1">
          {(row.programs ?? []).map((p) => (
            <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {p}
            </span>
          ))}
        </div>
      ),
    },
    {
      field: 'intake',
      title: 'Intake',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm">{row.intake}</span>
        </div>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.status === 'Active' ? 'bg-secondary-50 text-secondary' : 'bg-red-50 text-red-500'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${row.status === 'Active' ? 'bg-secondary' : 'bg-red-400'}`}
            />
            {row.status}
          </span>
        </div>
      ),
    },
  ];
  const actions: Action<IDepartment>[] = [
    ...(canManage
      ? [
          {
            tooltip: 'Edit',
            icon: <Pencil className="h-4 w-4 text-primary" />,
            onClick: (row: IDepartment) => {
              setEditing(row);
              setModalOpen(true);
            },
          },
        ]
      : []),
    ...(canDeactivate
      ? [
          {
            tooltip: 'Deactivate',
            icon: <Trash2 className="h-4 w-4 text-red-500" />,
            onClick: handleDelete,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Total',
            value: departments.length,
            icon: <Building2 className="h-5 w-5" />,
            bg: 'bg-primary-50',
            text: 'text-primary',
          },
          {
            label: 'Active',
            value: active,
            icon: <CheckCircle className="h-5 w-5" />,
            bg: 'bg-secondary-50',
            text: 'text-secondary',
          },
          {
            label: 'Total Intake',
            value: totalIntake,
            icon: <Users className="h-5 w-5" />,
            bg: 'bg-amber-50',
            text: 'text-amber-600',
          },
          {
            label: 'Program Types',
            value: offeredProgramTypes,
            icon: <GraduationCap className="h-5 w-5" />,
            bg: 'bg-purple-50',
            text: 'text-purple-600',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className="rounded-2xl bg-white p-5"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg}`}>
              <span className={s.text}>{s.icon}</span>
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <DataViewSwitcher<IDepartment>
          data={departments}
          isLoading={isLoading}
          storageKey="departments.view"
          searchPlaceholder="Search departments…"
          searchFields={['name', 'code', 'shortName', 'hodName', 'email']}
          renderCard={(d) => (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    d.status === 'Active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                <p className="font-mono text-xs text-slate-600">
                  {d.code} · {d.shortName}
                </p>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                {d.hodName && (
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-slate-600" />
                    <span className="truncate">HoD: {d.hodName}</span>
                  </p>
                )}
                {d.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-slate-600" />
                    <span className="truncate">{d.email}</span>
                  </p>
                )}
                {d.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-slate-600" />
                    <span>{d.phone}</span>
                  </p>
                )}
                {d.location && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-slate-600" />
                    <span className="truncate">{d.location}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>
                  Intake <span className="font-semibold text-slate-800">{d.intake ?? 0}</span> ·{' '}
                  {(d.programs ?? []).length} offered
                </span>
                {(canManage || canDeactivate) && (
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(d);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                    {canDeactivate && (
                      <button
                        type="button"
                        onClick={() => handleDelete(d)}
                        className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          table={
            <div className="rounded-2xl bg-white overflow-hidden">
              <CustomTable<IDepartment>
                title="Departments"
                description="Manage academic departments and intake"
                onRefresh={() => mutate()}
                isRefreshing={isValidating}
                data={departments}
                columns={columns}
                actions={actions}
                isLoading={isLoading}
                customActions={
                  <div className="flex items-center gap-2">
                    {canImport && (
                      <CustomButton
                        variant="secondary"
                        startIcon={<UploadCloud className="h-4 w-4" />}
                        onClick={() => setShowImport(true)}
                      >
                        Import departments
                      </CustomButton>
                    )}
                    <CrudButton
                      module={'department'}
                      action={'create'}
                      startIcon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setEditing(null);
                        setModalOpen(true);
                      }}
                    >
                      Add Department
                    </CrudButton>
                  </div>
                }
                options={{
                  search: false,
                  pagination: true,
                  pageSize: 10,
                  actionsType: 'dropdown',
                  export: false,
                }}
              />
            </div>
          }
        />
      </motion.div>

      <DepartmentModal
        open={canManage && modalOpen}
        editing={editing}
        saving={saving}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
      <ImportMigrationDialog
        open={showImport}
        target="departments"
        title="Departments"
        onClose={() => setShowImport(false)}
        onImported={() => void mutate()}
      />
    </div>
  );
}

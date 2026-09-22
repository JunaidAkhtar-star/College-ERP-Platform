'use client';

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { Plus, Pencil, BookOpen, Layers, FlaskConical, ToggleLeft, PlayCircle } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CrudButton from '@/shared/core/CrudButton';
import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';

import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasAnyRole } from '@/shared/hooks/useHasRole';
import { useAuthStore } from '@/shared/store/authStore';
import type { ISubject } from '../types/subjects.types';
import SubjectModal from './SubjectModal';

export default function SubjectsPage() {
  const role = useAuthStore((state) => state.role) ?? 'student';
  const isStudent = role === 'student';
  const isFaculty = role === 'faculty';
  const isHod = role === 'hod';
  const canManage = useHasAnyRole(['super_admin', 'principal', 'dean_academic', 'hod']);
  const canDeactivate = useHasAnyRole(['super_admin', 'principal', 'dean_academic']);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ISubject | null>(null);

  const { data: raw, isLoading, isValidating, mutate } = useSwr('subject');
  const all: ISubject[] = (raw as { data?: { data?: ISubject[] } })?.data?.data ?? [];
  const subjects = all;
  const { mutation, isLoading: saving } = useMutation();

  const active = all.filter((s) => s.isActive).length;
  const withLab = all.filter((s) => s.hasLabComponent).length;
  const electives = all.filter((s) => s.isElective).length;

  const handleStatus = async (row: ISubject, isActive: boolean) => {
    const res = await Swal.fire({
      title: `${isActive ? 'Activate' : 'Deactivate'} "${row.code}"?`,
      text: isActive
        ? 'The subject will become available for new academic configuration.'
        : 'The subject will be hidden from new configuration but historical records remain safe.',
      icon: isActive ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0178D7',
      confirmButtonText: isActive ? 'Activate' : 'Deactivate',
    });
    if (!res.isConfirmed) return;
    const r = await mutation(`subject/${row._id}/status`, {
      method: 'PATCH',
      body: { isActive },
    });
    if ((r as { results?: { success?: boolean } })?.results?.success) {
      toast.success(isActive ? 'Subject activated' : 'Subject deactivated');
      mutate();
    } else toast.error('Failed');
  };

  const handleSave = async (values: Partial<ISubject>) => {
    const r = await mutation(editing ? `subject/${editing._id}` : 'subject', {
      method: editing ? 'PUT' : 'POST',
      body: values,
    });
    if ((r as { results?: { success?: boolean } })?.results?.success) {
      toast.success(editing ? 'Updated' : 'Created');
      mutate();
      setModalOpen(false);
      setEditing(null);
    } else toast.error((r as { results?: { message?: string } })?.results?.message ?? 'Failed');
  };

  const columns: Column<ISubject>[] = [
    {
      field: 'code',
      title: 'Code',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="font-mono text-xs font-bold text-primary bg-primary-50 rounded px-2 py-0.5">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      field: 'name',
      title: 'Subject',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-600">{row.shortName}</p>
        </div>
      ),
    },
    {
      field: 'type',
      title: 'Type',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">
            {row.type}
          </span>
        </div>
      ),
    },
    {
      field: 'credits',
      title: 'Credits',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm font-semibold text-slate-800">{row.credits}</span>
        </div>
      ),
    },
    {
      field: 'departmentCode',
      title: 'Dept',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-xs font-mono text-slate-500">{row.departmentCode}</span>
        </div>
      ),
    },
    {
      field: 'isActive',
      title: 'Status',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span
            className={`text-xs rounded-full px-2 py-0.5 font-medium ${row.isActive ? 'bg-secondary-50 text-secondary' : 'bg-red-50 text-red-500'}`}
          >
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
    },
  ];
  const actions: Action<ISubject>[] = [
    ...(canManage
      ? [
          {
            tooltip: 'Edit',
            icon: <Pencil className="h-4 w-4 text-primary" />,
            onClick: (row: ISubject) => {
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
            icon: <ToggleLeft className="h-4 w-4 text-amber-600" />,
            onClick: (row: ISubject) => handleStatus(row, false),
            hidden: (row: ISubject) => !row.isActive,
          },
          {
            tooltip: 'Activate',
            icon: <PlayCircle className="h-4 w-4 text-emerald-600" />,
            onClick: (row: ISubject) => handleStatus(row, true),
            hidden: (row: ISubject) => row.isActive,
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
            label: 'Total Subjects',
            value: all.length,
            icon: <BookOpen className="h-5 w-5" />,
            bg: 'bg-primary-50',
            text: 'text-primary',
          },
          {
            label: 'Active',
            value: active,
            icon: <ToggleLeft className="h-5 w-5" />,
            bg: 'bg-secondary-50',
            text: 'text-secondary',
          },
          {
            label: 'With Lab',
            value: withLab,
            icon: <FlaskConical className="h-5 w-5" />,
            bg: 'bg-amber-50',
            text: 'text-amber-600',
          },
          {
            label: 'Electives',
            value: electives,
            icon: <Layers className="h-5 w-5" />,
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
        <DataViewSwitcher<ISubject>
          data={subjects}
          isLoading={isLoading}
          storageKey="subjects.view"
          searchPlaceholder="Search subjects…"
          searchFields={['name', 'code', 'shortName', 'departmentCode']}
          renderCard={(s) => (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  {s.hasLabComponent ? (
                    <FlaskConical className="h-5 w-5" />
                  ) : (
                    <BookOpen className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                <p className="font-mono text-xs text-slate-600">
                  {s.code} · {s.type}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-slate-600">Credits</p>
                  <p className="font-bold text-slate-800">{s.credits}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-slate-600">L–T–P</p>
                  <p className="font-bold text-slate-800">
                    {s.lectureHours}–{s.tutorialHours}–{s.practicalHours}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>{s.departmentCode}</span>
                {(canManage || canDeactivate) && (
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(s);
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
                        onClick={() => handleStatus(s, !s.isActive)}
                        className={`inline-flex items-center gap-1 font-medium hover:underline ${
                          s.isActive ? 'text-red-500' : 'text-emerald-600'
                        }`}
                      >
                        {s.isActive ? (
                          <ToggleLeft className="h-3 w-3" />
                        ) : (
                          <PlayCircle className="h-3 w-3" />
                        )}
                        {s.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          table={
            <div className="rounded-2xl bg-white overflow-hidden">
              <CustomTable<ISubject>
                title={
                  isStudent
                    ? 'My Course Catalogue'
                    : isFaculty
                      ? 'Department Subjects'
                      : isHod
                        ? 'Department Subject Master'
                        : 'Subjects Master'
                }
                description={
                  isStudent
                    ? 'Curriculum syllabus, credit weights, and course structure'
                    : 'Course catalogue, credits, and teaching lecture-tutorial-practical breakdown'
                }
                onRefresh={() => mutate()}
                isRefreshing={isValidating}
                data={subjects}
                columns={columns}
                actions={actions}
                isLoading={isLoading}
                customActions={
                  canManage ? (
                    <CrudButton
                      module={'subject'}
                      action={'create'}
                      startIcon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setEditing(null);
                        setModalOpen(true);
                      }}
                    >
                      Add Subject
                    </CrudButton>
                  ) : undefined
                }
                options={{
                  search: false,
                  pagination: true,
                  pageSize: 15,
                  actionsType: 'dropdown',
                  export: false,
                }}
              />
            </div>
          }
        />
      </motion.div>

      <SubjectModal
        open={canManage && modalOpen}
        editing={editing}
        saving={saving}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}

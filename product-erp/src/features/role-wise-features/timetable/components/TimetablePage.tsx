/**
 * @file TimetablePage.tsx
 * @description Timetable management page.
 * Google Calendar-style week grid with meeting overlay, slot add/edit,
 * conflict detection, filters, and substitute assignment.
 * @module features/role-wise-features/timetable
 */
'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  IconButton as MuiIconButton,
  Menu as MuiMenu,
  MenuItem as MuiMenuItem,
  Tooltip as MuiTooltip,
} from '@mui/material';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  List,
  CheckCircle,
  Archive,
  Zap,
  LayoutGrid,
  Search,
  GraduationCap,
  User,
  Printer,
  MoreHorizontal,
  X,
  CalendarPlus,
  ArrowRight,
  MapPin,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import TimetableModal, { SlotModal } from './TimetableModal';
import TimetableGrid, { IMeetingEvent } from './TimetableGrid';
import { ITimetable, ITimetableSlot, TDay } from '../types/timetable.types';
import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';

const TimetablePrintView = dynamic(() => import('./TimetablePrintView'), { ssr: false });

type TView = 'grid' | 'list';
const TEACHING_DAYS: TDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function TimetablePage() {
  const [view, setView] = useState<TView>('grid');
  const [showTtModal, setShowTtModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [editingTt, setEditingTt] = useState<ITimetable | null>(null);
  const [publishingTt, setPublishingTt] = useState<ITimetable | null>(null);
  const [operationsTt, setOperationsTt] = useState<ITimetable | null>(null);
  const [selectedTtState, setSelectedTt] = useState<ITimetable | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [editSlot, setEditSlot] = useState<{ slot: ITimetableSlot; index: number } | null>(null);
  const [addSlotDefaults, setAddSlotDefaults] = useState<{
    day: TDay;
    startTime: string;
    branchDepartmentId?: string;
    branch?: string;
  } | null>(null);

  // Filters
  const [filterCurriculum, setFilterCurriculum] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterSemType, setFilterSemType] = useState('');
  const [filterSem, setFilterSem] = useState('');

  // ── Timetable list fetch ────────────────────────────────────────────────────
  const qp = new URLSearchParams({ limit: '100' });
  if (filterCurriculum) qp.set('curriculumId', filterCurriculum);
  if (filterDepartment) qp.set('departmentId', filterDepartment);
  if (filterSemType) qp.set('semesterType', filterSemType);
  if (filterSem) qp.set('semester', filterSem);
  const qs = qp.toString() ? `?${qp.toString()}` : '';

  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('timetable', 'view');
  const hasEditPermission = useHasPermission('timetable', 'edit');
  const hasApprovePermission = useHasPermission('timetable', 'approve');
  const {
    data: raw,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSwr(canView ? `timetable${qs}` : null);
  const records = useMemo(() => (raw as { data?: ITimetable[] })?.data ?? [], [raw]);

  // ── Meetings request (for calendar overlay) ─────────────────────────────────
  const { data: meetingRaw } = useSwr('meeting?status=scheduled&status=ongoing');
  const meetings: IMeetingEvent[] = (meetingRaw as { data?: IMeetingEvent[] })?.data ?? [];

  const { mutation } = useMutation();

  // Only academic/admin/HOD roles can manage timetables; students & faculty only view.
  const canManage =
    ['super_admin', 'admin', 'principal', 'dean_academic', 'hod'].includes(activeRole ?? '') &&
    hasEditPermission;
  const canApprove =
    ['super_admin', 'admin', 'principal', 'dean_academic'].includes(activeRole ?? '') &&
    hasApprovePermission;

  // ── Filtered records ─────────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (filterSemType && r.semesterType !== filterSemType) return false;
        if (filterSem && String(r.semester) !== filterSem) return false;
        return true;
      }),
    [records, filterSemType, filterSem],
  );

  const selectedTt = useMemo(
    () => filtered.find((item) => item._id === selectedTtState?._id) ?? filtered[0] ?? null,
    [filtered, selectedTtState?._id],
  );

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const totalActive = records.filter((r) => r.isActive).length;
  const totalApproved = records.filter((r) => r.isApproved).length;
  const totalSlots = records.reduce((acc, r) => acc + (r.slots?.length ?? 0), 0);

  // ── Dept name helper ─────────────────────────────────────────────────────────
  const getDeptName = (t: ITimetable) =>
    typeof t.departmentId === 'object' ? (t.departmentId as { name: string }).name : '—';

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleDelete = async (row: ITimetable) => {
    const res = await Swal.fire({
      title: 'Delete Timetable?',
      text: `${row.program} Sem ${row.semester} (${row.section || 'Whole cohort'}) — ${row.academicYear}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      confirmButtonColor: '#0178D7',
    });
    if (!res.isConfirmed) return;
    const r = await mutation(`timetable/${row._id}`, { method: 'DELETE', isAlert: true });
    if ((r as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Timetable deleted');
      if (selectedTt?._id === row._id) setSelectedTt(null);
      mutate();
    } else toast.error('Failed');
  };

  const handleArchive = async (row: ITimetable) => {
    const confirmation = await Swal.fire({
      title: 'Archive this timetable?',
      text: 'It will no longer be visible to students or faculty. Historical data will be retained.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Archive timetable',
      confirmButtonColor: '#b45309',
    });
    if (!confirmation.isConfirmed) return;
    const r = await mutation(`timetable/${row._id}/archive`, {
      method: 'POST',
      isAlert: true,
    });
    if ((r as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Timetable archived');
      if (selectedTt?._id === row._id) setSelectedTt(null);
      mutate();
    } else toast.error('Unable to archive timetable');
  };

  // When a slot is added/edited via grid click
  const handleAddSlotFromGrid = (
    day: TDay,
    startTime: string,
    branchDepartmentId?: string,
    branch?: string,
  ) => {
    if (!selectedTt) return;
    setAddSlotDefaults({ day, startTime, branchDepartmentId, branch });
    setEditSlot(null);
    setShowSlotModal(true);
  };

  const handleEditSlotFromGrid = (slot: ITimetableSlot, index: number) => {
    if (!selectedTt) return;
    setEditSlot({ slot, index });
    setAddSlotDefaults(null);
    setShowSlotModal(true);
  };

  const handleSlotSaved = (updatedTimetable?: ITimetable) => {
    mutate();
    setShowSlotModal(false);
    setEditSlot(null);
    setAddSlotDefaults(null);
    if (updatedTimetable) setSelectedTt(updatedTimetable);
  };

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns: Column<ITimetable>[] = [
    {
      field: 'program',
      title: 'Program',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.program}</p>
          <p className="text-xs text-slate-600">
            Sem {row.semester} · {row.section || 'Whole cohort'} · {getDeptName(row)}
          </p>
        </div>
      ),
    },
    {
      field: 'academicYear',
      title: 'Academic Year',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex flex-col items-center">
          <p className="text-sm text-slate-700">{row.academicYear}</p>
          <span
            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${row.semesterType === 'odd' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}
          >
            {row.semesterType}
          </span>
        </div>
      ),
    },
    {
      field: 'slots',
      title: 'Slots',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm font-medium text-slate-700">{row.slots?.length ?? 0}</span>
        </div>
      ),
    },
    {
      field: 'isApproved',
      title: 'Status',
      cellClassName: '!text-center',
      render: (row) => {
        const status = !row.isActive ? 'Archived' : row.isApproved ? 'Published' : 'Draft';
        const color =
          status === 'Published'
            ? 'bg-green-50 text-green-600'
            : status === 'Archived'
              ? 'bg-slate-100 text-slate-500'
              : 'bg-amber-50 text-amber-600';
        const dot =
          status === 'Published'
            ? 'bg-green-400'
            : status === 'Archived'
              ? 'bg-slate-400'
              : 'bg-amber-400';
        return (
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {status}
            </span>
          </div>
        );
      },
    },
  ];

  const tableActions: Action<ITimetable>[] = [
    {
      tooltip: 'View in Grid',
      icon: <LayoutGrid className="h-4 w-4 text-primary" />,
      onClick: (row) => {
        setSelectedTt(row);
        setView('grid');
      },
    },
    ...(canManage
      ? [
          {
            tooltip: 'Edit',
            icon: <Pencil className="h-4 w-4 text-primary" />,
            onClick: (row: ITimetable) => {
              setEditingTt(row);
              setShowTtModal(true);
            },
            hidden: (row: ITimetable) => row.isApproved || !row.isActive,
          },
          {
            tooltip: 'Delete',
            icon: <Trash2 className="h-4 w-4 text-red-500" />,
            onClick: (row: ITimetable) => handleDelete(row),
            hidden: (row: ITimetable) => row.isApproved || !row.isActive,
          },
        ]
      : []),
    ...(canApprove
      ? [
          {
            tooltip: 'Publish',
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
            onClick: (row: ITimetable) => setPublishingTt(row),
            hidden: (row: ITimetable) => row.isApproved || !row.isActive,
          },
        ]
      : []),
    ...(canApprove
      ? [
          {
            tooltip: 'Archive',
            icon: <Archive className="h-4 w-4 text-amber-600" />,
            onClick: (row: ITimetable) => handleArchive(row),
            hidden: (row: ITimetable) => !row.isApproved || !row.isActive,
          },
        ]
      : []),
  ];

  if (activeRole === 'faculty') {
    return <FacultyTeachingSchedule records={records} loading={isLoading} error={error} />;
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Timetable access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role does not have permission to view timetable data.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Timetable could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />
      {/* Header */}
      {view === 'grid' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Timetable</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage class schedules with Google Calendar-style grid
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${(view as string) === 'grid' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Calendar
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${(view as string) === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
            {canManage && (
              <CustomButton
                variant="primary"
                startIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setEditingTt(null);
                  setShowTtModal(true);
                }}
                className="w-fit!"
              >
                New Timetable
              </CustomButton>
            )}
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Total',
            value: records.length,
            icon: <Calendar className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
          {
            label: 'Active',
            value: totalActive,
            icon: <Clock className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Approved',
            value: totalApproved,
            icon: <CheckCircle className="h-4.5 w-4.5" />,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Total Slots',
            value: totalSlots,
            icon: <LayoutGrid className="h-4.5 w-4.5" />,
            color: 'bg-purple-50 text-purple-600',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-xl bg-white p-4"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}
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

      {/* Filters */}
      <div className="grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.85fr_0.85fr_auto] xl:items-end">
        <AsyncSelect
          type="curricula"
          label="Curriculum"
          placeholder="All curricula"
          value={filterCurriculum || null}
          onChange={(value) => {
            setFilterCurriculum(value ?? '');
            setFilterDepartment('');
            setFilterSem('');
            setFilterSemType('');
          }}
          emptyMessage="No active curricula are configured."
        />
        <AsyncSelect
          type="departments"
          label="Branch / Department"
          placeholder={filterCurriculum ? 'All branches' : 'Select curriculum first'}
          params={{ curriculumId: filterCurriculum }}
          value={filterDepartment || null}
          onChange={(value) => {
            setFilterDepartment(value ?? '');
            setFilterSem('');
            setFilterSemType('');
          }}
          disabled={!filterCurriculum}
          emptyMessage="No branch is linked to this curriculum."
        />
        <div>
          <AsyncSelect
            type="semesters"
            label="Semester"
            placeholder={filterDepartment ? 'All semesters' : 'Select branch first'}
            params={{
              configured: true,
              curriculumId: filterCurriculum,
              departmentId: filterDepartment,
            }}
            limit={12}
            value={filterSem || null}
            onChange={(v) => setFilterSem(v ?? '')}
            disabled={!filterCurriculum || !filterDepartment}
            emptyMessage="No configured semesters found. Create sections in Academic Structure first."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Semester Type</label>
          <select
            value={filterSemType}
            onChange={(e) => setFilterSemType(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-primary focus:bg-white focus:outline-none"
          >
            <option value="">All semester types</option>
            <option value="odd">Odd</option>
            <option value="even">Even</option>
          </select>
        </div>
        <div className="flex items-center justify-end">
          {(filterCurriculum || filterDepartment || filterSemType || filterSem) && (
            <button
              type="button"
              onClick={() => {
                setFilterSemType('');
                setFilterSem('');
                setFilterCurriculum('');
                setFilterDepartment('');
              }}
              className="h-10 rounded-lg px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Grid View */}
      {view === 'grid' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Timetable selector and lifecycle actions */}
          {filtered.length > 0 && (
            <div className="grid gap-3 rounded-xl bg-white p-4 lg:grid-cols-[minmax(260px,29rem)_minmax(0,1fr)] lg:items-end">
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Timetable</label>
                <select
                  value={selectedTt?._id ?? ''}
                  onChange={(event) => {
                    setSelectedTt(filtered.find((item) => item._id === event.target.value) ?? null);
                  }}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select a timetable</option>
                  {filtered.map((item) => {
                    const department =
                      typeof item.departmentId === 'object' ? item.departmentId.code : '';
                    const status = item.isApproved ? 'Published' : 'Draft';
                    return (
                      <option key={item._id} value={item._id}>
                        {item.program} · {department} · Sem {item.semester} ·{' '}
                        {item.section ? `Section ${item.section}` : 'Whole cohort'} ·{' '}
                        {item.academicYear} · {status}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="flex min-h-10 min-w-0 flex-wrap items-center justify-end gap-2">
                {canManage && selectedTt && !selectedTt.isApproved && selectedTt.isActive && (
                  <CustomButton
                    variant="secondary"
                    startIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setAddSlotDefaults({ day: 'Monday', startTime: '09:00' });
                      setEditSlot(null);
                      setShowSlotModal(true);
                    }}
                    className="w-fit! text-xs py-1"
                  >
                    Add Period
                  </CustomButton>
                )}
                <CustomButton
                  variant="secondary"
                  startIcon={<Printer className="h-3.5 w-3.5" />}
                  onClick={() => setShowPrintView(true)}
                  disabled={!selectedTt}
                  className="w-fit! text-xs py-1"
                >
                  Print Preview
                </CustomButton>
                {canApprove && selectedTt && !selectedTt.isApproved && selectedTt.isActive && (
                  <CustomButton
                    variant="primary"
                    startIcon={<CheckCircle className="h-3.5 w-3.5" />}
                    onClick={() => setPublishingTt(selectedTt)}
                    className="w-fit! text-xs py-1"
                  >
                    Publish Timetable
                  </CustomButton>
                )}
                {(canManage || canApprove) && (
                  <MuiTooltip title="More timetable actions" arrow placement="top">
                    <span className="inline-flex">
                      <MuiIconButton
                        aria-label="More timetable actions"
                        aria-controls={actionMenuAnchor ? 'timetable-actions-menu' : undefined}
                        aria-haspopup="menu"
                        aria-expanded={actionMenuAnchor ? 'true' : undefined}
                        onClick={(event) => setActionMenuAnchor(event.currentTarget)}
                        disabled={
                          !selectedTt ||
                          !selectedTt.isActive ||
                          (!canManage && !(canApprove && selectedTt.isApproved))
                        }
                        size="small"
                        sx={{
                          width: 40,
                          height: 40,
                          border: '1px solid #74c9d5',
                          borderRadius: '8px',
                          color: '#2499aa',
                          '&:hover': { backgroundColor: 'rgba(116, 201, 213, 0.10)' },
                        }}
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </MuiIconButton>
                    </span>
                  </MuiTooltip>
                )}
                <MuiMenu
                  id="timetable-actions-menu"
                  anchorEl={actionMenuAnchor}
                  open={Boolean(actionMenuAnchor)}
                  onClose={() => setActionMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  {canManage && selectedTt && !selectedTt.isApproved && selectedTt.isActive && (
                    <MuiMenuItem
                      onClick={() => {
                        setActionMenuAnchor(null);
                        setEditingTt(selectedTt);
                        setShowTtModal(true);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Edit timetable
                    </MuiMenuItem>
                  )}
                  {canManage && selectedTt?.isApproved && selectedTt.isActive && (
                    <MuiMenuItem
                      onClick={() => {
                        setActionMenuAnchor(null);
                        setOperationsTt(selectedTt);
                      }}
                    >
                      <CalendarPlus className="mr-2 h-4 w-4" /> Extra classes & replacements
                    </MuiMenuItem>
                  )}
                  {canManage && selectedTt?.isApproved && selectedTt.isActive && (
                    <MuiMenuItem
                      onClick={() => {
                        setActionMenuAnchor(null);
                        setEditingTt(selectedTt);
                        setShowTtModal(true);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Document details
                    </MuiMenuItem>
                  )}
                  {canApprove && selectedTt?.isApproved && selectedTt.isActive && (
                    <MuiMenuItem
                      onClick={() => {
                        setActionMenuAnchor(null);
                        handleArchive(selectedTt);
                      }}
                    >
                      <Archive className="mr-2 h-4 w-4" /> Archive timetable
                    </MuiMenuItem>
                  )}
                  {canManage && selectedTt && !selectedTt.isApproved && selectedTt.isActive && (
                    <MuiMenuItem
                      className="text-red-600!"
                      onClick={() => {
                        setActionMenuAnchor(null);
                        handleDelete(selectedTt);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete draft
                    </MuiMenuItem>
                  )}
                </MuiMenu>
              </div>
            </div>
          )}

          {/* Calendar grid */}
          <TimetableGrid
            timetable={selectedTt}
            meetings={meetings}
            onAddSlot={canManage ? handleAddSlotFromGrid : undefined}
            onEditSlot={canManage ? handleEditSlotFromGrid : undefined}
            canAssignSubstitute={
              canManage && Boolean(selectedTt?.isApproved && selectedTt.isActive)
            }
            onMutate={(updatedTimetable) => {
              mutate();
              if (updatedTimetable) setSelectedTt(updatedTimetable);
            }}
          />
        </motion.div>
      )}

      {/* List View */}
      {view === 'list' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <DataViewSwitcher<ITimetable>
            data={filtered}
            isLoading={isLoading}
            storageKey="timetable.view"
            searchPlaceholder="Search timetables…"
            searchFields={['program', 'section', 'academicYear', 'semesterType']}
            renderCard={(t) => {
              const dept = typeof t.departmentId === 'object' ? t.departmentId : null;
              return (
                <motion.div
                  whileHover={{ y: -2 }}
                  className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.isApproved ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}
                      >
                        {t.isApproved ? (t.isActive ? 'Published' : 'Archived') : 'Draft'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {t.program} · Sem {t.semester}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.section ? `Section ${t.section}` : 'Whole cohort'} · AY {t.academicYear}
                    </p>
                    {dept && (
                      <p className="text-[11px] text-slate-600">
                        {dept.name} ({dept.code})
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {Array.isArray(t.slots) ? t.slots.length : 0} slots
                    </span>
                    <span className="text-[10px] uppercase tracking-wide">{t.semesterType}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTt(t);
                        setView('grid');
                      }}
                      className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
                    >
                      <LayoutGrid className="h-3 w-3" /> Grid
                    </button>
                    {canManage && !t.isApproved && t.isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTt(t);
                          setShowTtModal(true);
                        }}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                    {canApprove && !t.isApproved && t.isActive && (
                      <button
                        type="button"
                        onClick={() => setPublishingTt(t)}
                        className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                      >
                        <CheckCircle className="h-3 w-3" /> Publish
                      </button>
                    )}
                    {canManage && !t.isApproved && t.isActive && (
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            }}
            table={
              <div className="rounded-2xl bg-white overflow-hidden">
                <CustomTable<ITimetable>
                  title="Timetable"
                  description="Manage class schedules with Google Calendar-style grid"
                  onRefresh={() => mutate()}
                  isRefreshing={isValidating}
                  data={filtered}
                  columns={columns}
                  actions={tableActions}
                  isLoading={isLoading}
                  customActions={
                    <div className="flex items-center gap-3">
                      <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => setView('grid')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${(view as string) === 'grid' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Calendar
                        </button>
                        <button
                          type="button"
                          onClick={() => setView('list')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${(view as string) === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          <List className="h-3.5 w-3.5" />
                          List
                        </button>
                      </div>
                      {canManage && (
                        <CustomButton
                          variant="primary"
                          startIcon={<Plus className="h-4 w-4" />}
                          onClick={() => {
                            setEditingTt(null);
                            setShowTtModal(true);
                          }}
                          className="w-fit!"
                        >
                          New Timetable
                        </CustomButton>
                      )}
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
      )}

      {/* Timetable Header Modal */}
      <AnimatePresence>
        {showTtModal && (
          <TimetableModal
            editing={editingTt}
            onClose={() => {
              setShowTtModal(false);
              setEditingTt(null);
            }}
            onSaved={() => {
              mutate();
              setShowTtModal(false);
              setEditingTt(null);
            }}
          />
        )}
        {publishingTt && (
          <PublishTimetableModal
            timetable={publishingTt}
            onClose={() => setPublishingTt(null)}
            onPublished={(published) => {
              setPublishingTt(null);
              if (selectedTt?._id === published._id) {
                setSelectedTt({ ...published, isApproved: true });
              }
              mutate();
            }}
          />
        )}
        {operationsTt && (
          <ClassOperationsModal
            timetable={operationsTt}
            onClose={() => setOperationsTt(null)}
            onChanged={() => mutate()}
          />
        )}
      </AnimatePresence>

      {/* Slot Add/Edit Modal */}
      <AnimatePresence>
        {showSlotModal && selectedTt && (
          <SlotModal
            timetable={selectedTt}
            editSlot={editSlot}
            defaultDay={addSlotDefaults?.day}
            defaultStartTime={addSlotDefaults?.startTime}
            defaultBranchDepartmentId={addSlotDefaults?.branchDepartmentId}
            defaultBranch={addSlotDefaults?.branch}
            onClose={() => {
              setShowSlotModal(false);
              setEditSlot(null);
              setAddSlotDefaults(null);
            }}
            onSaved={handleSlotSaved}
          />
        )}
        {showPrintView && selectedTt && (
          <TimetablePrintView timetable={selectedTt} onClose={() => setShowPrintView(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function FacultyTeachingSchedule({
  records,
  loading,
  error,
}: {
  records: ITimetable[];
  loading: boolean;
  error?: Error;
}) {
  const { tenant, role } = useParams<{ tenant: string; role: string }>();
  const user = useAuthStore((state) => state.user);
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const facultyId = user?._id ?? '';
  const todayIndex = new Date().getDay();
  const today = TEACHING_DAYS[todayIndex - 1];
  const classes = useMemo(
    () =>
      records
        .flatMap((timetable) =>
          (timetable.slots ?? [])
            .filter(
              (slot) =>
                String(slot.facultyId ?? '') === facultyId &&
                (slot.slotKind ?? 'teaching') === 'teaching',
            )
            .map((slot) => ({ timetable, slot })),
        )
        .sort((a, b) => {
          const dayDifference =
            TEACHING_DAYS.indexOf(a.slot.day) - TEACHING_DAYS.indexOf(b.slot.day);
          return dayDifference || a.slot.startTime.localeCompare(b.slot.startTime);
        }),
    [facultyId, records],
  );
  const todayClasses = classes.filter(({ slot }) => slot.day === today);
  const todayIso = now.toISOString().slice(0, 10);
  const { data: attendanceRaw } = useSwr(`attendance?date=${todayIso}`);
  const attendanceRecords =
    (
      attendanceRaw as {
        data?: Array<{
          _id: string;
          timetableId?: string;
          timetableSlotId?: string;
          subjectId: string;
          periodNumber: number;
          totalPresent?: number;
          totalStrength?: number;
        }>;
      }
    )?.data ?? [];
  const attendanceFor = (timetable: ITimetable, slot: ITimetableSlot) =>
    attendanceRecords.find(
      (record) =>
        (slot._id && String(record.timetableSlotId ?? '') === String(slot._id)) ||
        (String(record.timetableId ?? '') === timetable._id &&
          String(record.subjectId) === String(slot.subjectId) &&
          record.periodNumber === slot.periodNo),
    );
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const minutesOf = (value: string) => {
    const [hour = 0, minute = 0] = value.split(':').map(Number);
    return hour * 60 + minute;
  };
  const statusFor = (timetable: ITimetable, slot: ITimetableSlot) => {
    const attendance = attendanceFor(timetable, slot);
    if (attendance) return { key: 'completed', label: 'Attendance completed', attendance };
    const start = minutesOf(slot.startTime);
    const end = minutesOf(slot.endTime);
    if (minutesNow > end) return { key: 'missed', label: 'Attendance pending', attendance: null };
    if (minutesNow >= start)
      return {
        key: 'live',
        label: `Class live · ${Math.max(0, end - minutesNow)} min left`,
        attendance: null,
      };
    return { key: 'upcoming', label: `Starts in ${start - minutesNow} min`, attendance: null };
  };
  const uniqueSubjects = new Set(
    classes.map(({ slot }) => String(slot.subjectId ?? slot.subjectCode)),
  ).size;
  const uniqueRooms = new Set(classes.map(({ slot }) => slot.roomNo).filter(Boolean)).size;
  const attendanceHref = `/${tenant}/${role}/attendance`;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Your teaching schedule could not load
        </h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 bg-linear-to-r from-primary-50 via-white to-secondary-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Faculty workspace
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">My Teaching Schedule</h1>
            <p className="mt-1 text-sm text-slate-600">
              Your assigned classes, rooms and attendance actions in one place.
            </p>
          </div>
          <Link
            href={attendanceHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white  transition-colors hover:bg-primary/90"
          >
            Open attendance <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
          {[
            ['Today', String(todayClasses.length), Calendar],
            ['Assigned subjects', String(uniqueSubjects), GraduationCap],
            ['Teaching rooms', String(uniqueRooms), MapPin],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="flex items-center gap-3 bg-white px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xl font-bold text-slate-900">{loading ? '—' : String(value)}</p>
                <p className="text-xs font-medium text-slate-500">{String(label)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Today&apos;s classes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Open attendance to load the enrolled student roster and record presence.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: '2-digit',
              month: 'short',
            })}
          </span>
        </div>
        {loading ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {[1, 2].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : todayClasses.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {todayClasses.map(({ timetable, slot }) => {
              const status = statusFor(timetable, slot);
              const statusStyle =
                status.key === 'completed'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : status.key === 'missed'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : status.key === 'live'
                      ? 'border-primary/30 bg-primary-50 text-primary'
                      : 'border-amber-200 bg-amber-50 text-amber-700';
              return (
                <motion.article
                  key={`${timetable._id}-${slot.day}-${slot.periodNo}-${slot.subjectCode}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  className={`relative overflow-hidden rounded-xl border p-4 transition-colors ${status.key === 'missed' ? 'border-red-200' : status.key === 'live' ? 'border-primary/40 ring-2 ring-primary/10' : 'border-slate-200'} bg-white`}
                >
                  {status.key === 'live' && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute left-0 top-0 h-1 bg-primary"
                      initial={{ width: '20%' }}
                      animate={{ width: ['20%', '100%', '20%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-primary">
                        {slot.startTime}–{slot.endTime} · Period {slot.periodNo}
                      </p>
                      <h3 className="mt-1 truncate text-base font-bold text-slate-900">
                        {slot.subjectName}
                      </h3>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {slot.subjectCode} · {timetable.program} · Sem {timetable.semester}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">
                        {slot.classType}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusStyle}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-primary" />{' '}
                        {slot.roomName || slot.roomNo || 'Room not assigned'}
                      </span>
                      {(slot.roomName || slot.roomBuilding) && (
                        <p className="mt-0.5 pl-5 text-[11px] text-slate-600">
                          {[slot.roomNo, slot.roomBuilding, slot.roomFloor]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <Link
                      href={attendanceHref}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${status.key === 'completed' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : status.key === 'missed' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-primary text-white hover:bg-primary/90'}`}
                    >
                      <Users className="h-3.5 w-3.5" />{' '}
                      {status.key === 'completed'
                        ? `Review ${status.attendance?.totalPresent ?? 0}/${status.attendance?.totalStrength ?? 0}`
                        : status.key === 'missed'
                          ? 'Record pending attendance'
                          : 'Student roster & attendance'}
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 grid items-center gap-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 p-5 md:grid-cols-[minmax(0,1fr)_16rem]">
            <div>
              <p className="text-sm font-bold text-slate-800">No classes assigned today</p>
              <p className="mt-1 text-sm text-slate-500">
                Use the weekly plan below to prepare upcoming lessons and attendance.
              </p>
            </div>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/images/faculty/teaching-attendance-guide.png"
                alt="Lecturer preparing a classroom attendance roster"
                width={1536}
                height={1024}
                className="h-36 w-full rounded-xl object-cover object-center"
              />
            </motion.div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Weekly assignments</h2>
        <p className="mt-1 text-sm text-slate-500">Only periods assigned to you are shown.</p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {TEACHING_DAYS.map((day) => {
            const dayClasses = classes.filter(({ slot }) => slot.day === day);
            if (!dayClasses.length) return null;
            return (
              <div key={day} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5">
                  <h3 className="text-sm font-bold text-slate-800">{day}</h3>
                  <span className="text-xs font-semibold text-slate-600">
                    {dayClasses.length} classes
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {dayClasses.map(({ timetable, slot }) => (
                    <div
                      key={`${timetable._id}-${slot.periodNo}-${slot.subjectCode}`}
                      className="grid gap-2 px-4 py-3 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <span className="font-mono text-xs font-bold text-primary">
                        {slot.startTime}–{slot.endTime}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {slot.subjectName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {timetable.program} · Sem {timetable.semester} · {slot.subjectCode}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {slot.roomNo || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PublishTimetableModal({
  timetable,
  onClose,
  onPublished,
}: {
  timetable: ITimetable;
  onClose: () => void;
  onPublished: (timetable: ITimetable) => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [values, setValues] = useState({
    title: timetable.title ?? '',
    effectiveFrom: timetable.effectiveFrom?.slice(0, 10) ?? '',
    effectiveTo: timetable.effectiveTo?.slice(0, 10) ?? '',
    documentNo: timetable.documentNo ?? '',
  });

  const publish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.effectiveFrom) {
      toast.error('Select the effective-from date before publishing');
      return;
    }
    if (values.effectiveTo && values.effectiveTo < values.effectiveFrom) {
      toast.error('Effective-to date cannot be before the effective-from date');
      return;
    }

    const detailsResponse = await mutation(`timetable/${timetable._id}/publication-details`, {
      method: 'PATCH',
      body: values,
    });
    if (!(detailsResponse as { results?: { success?: boolean } })?.results?.success) return;

    const validationResponse = await mutation(`timetable/${timetable._id}/validate-publish`, {
      method: 'POST',
    });
    if (!(validationResponse as { results?: { success?: boolean } })?.results?.success) return;

    const publishResponse = await mutation(`timetable/${timetable._id}/approve`, {
      method: 'POST',
    });
    const result = publishResponse as {
      results?: { success?: boolean; data?: ITimetable };
    };
    if (!result?.results?.success || !result.results.data) return;

    toast.success('Timetable published successfully');
    onPublished(result.results.data);
  };

  const fieldClass =
    'mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label="Close publication details dialog"
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-timetable-title"
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white "
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="publish-timetable-title" className="text-lg font-semibold text-slate-900">
                Publish Timetable
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Add the official publication details before making this timetable visible.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={publish}>
          <div className="space-y-5 px-6 py-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">
                {timetable.program} · Semester {timetable.semester}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {timetable.section ? `Section ${timetable.section}` : 'Whole cohort'} ·{' '}
                {timetable.academicYear} · {timetable.slots.length} periods
              </p>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Timetable title
              <input
                className={fieldClass}
                value={values.title}
                maxLength={160}
                placeholder={`${timetable.program} Semester ${timetable.semester} Timetable`}
                onChange={(event) =>
                  setValues((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Effective from <span className="text-red-500">*</span>
                <input
                  type="date"
                  required
                  className={fieldClass}
                  value={values.effectiveFrom}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, effectiveFrom: event.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Effective to
                <input
                  type="date"
                  className={fieldClass}
                  min={values.effectiveFrom || undefined}
                  value={values.effectiveTo}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, effectiveTo: event.target.value }))
                  }
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Document / reference number
              <input
                className={fieldClass}
                value={values.documentNo}
                maxLength={80}
                placeholder="Optional"
                onChange={(event) =>
                  setValues((current) => ({ ...current, documentNo: event.target.value }))
                }
              />
            </label>

            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Publishing makes the timetable available to students and faculty. Its schedule becomes
              read-only after publication.
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <CustomButton
              type="button"
              variant="tertiary"
              onClick={onClose}
              disabled={isLoading}
              className="w-fit!"
            >
              Cancel
            </CustomButton>
            <CustomButton
              type="submit"
              variant="primary"
              startIcon={<CheckCircle className="h-4 w-4" />}
              loading={isLoading}
              className="w-fit!"
            >
              Publish Timetable
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

interface IClassOperation {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  subjectCode: string;
  facultyName: string;
  roomNo: string;
  reason: string;
  status: 'scheduled' | 'cancelled' | 'completed';
}

function ClassOperationsModal({
  timetable,
  onClose,
  onChanged,
}: {
  timetable: ITimetable;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const {
    data: operationsRaw,
    isLoading: operationsLoading,
    mutate: mutateOperations,
  } = useSwr(`timetable/${timetable._id}/class-operations`);
  const operations = (operationsRaw as { data?: IClassOperation[] } | undefined)?.data ?? [];
  const [values, setValues] = useState({
    subjectId: '',
    facultyId: '',
    roomId: '',
    roomNo: '',
    date: '',
    startTime: '',
    endTime: '',
    reason: '',
  });
  const [substitutions, setSubstitutions] = useState(timetable.substituteLog ?? []);
  const fieldClass =
    'mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';
  const curriculumId =
    typeof timetable.curriculumId === 'object'
      ? timetable.curriculumId._id
      : timetable.curriculumId;

  const createExtraClass = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !values.subjectId ||
      !values.facultyId ||
      !values.roomId ||
      !values.date ||
      !values.startTime ||
      !values.endTime ||
      values.reason.trim().length < 3
    ) {
      toast.error('Complete all required extra-class details');
      return;
    }
    const response = await mutation(`timetable/${timetable._id}/extra-class`, {
      method: 'POST',
      body: {
        ...values,
        branchDepartmentIds: timetable.branchDepartmentIds ?? [],
      },
    });
    if (!(response as { results?: { success?: boolean } })?.results?.success) return;
    toast.success('Extra class scheduled and notifications sent');
    setValues({
      subjectId: '',
      facultyId: '',
      roomId: '',
      roomNo: '',
      date: '',
      startTime: '',
      endTime: '',
      reason: '',
    });
    mutateOperations();
    onChanged();
  };

  const cancelExtraClass = async (operation: IClassOperation) => {
    const confirmation = await Swal.fire({
      title: 'Cancel this extra class?',
      text: `${operation.subjectName} · ${operation.date.slice(0, 10)} · ${operation.startTime}–${operation.endTime}`,
      input: 'text',
      inputLabel: 'Cancellation reason',
      inputPlaceholder: 'Enter a reason',
      showCancelButton: true,
      confirmButtonText: 'Cancel class',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) =>
        !value || value.trim().length < 3 ? 'Enter at least 3 characters' : undefined,
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation(
      `timetable/${timetable._id}/extra-class/${operation._id}/cancel`,
      { method: 'POST', body: { reason: confirmation.value } },
    );
    if (!(response as { results?: { success?: boolean } })?.results?.success) return;
    toast.success('Extra class cancelled');
    mutateOperations();
    onChanged();
  };

  const cancelSubstitute = async (entry: NonNullable<ITimetable['substituteLog']>[number]) => {
    const slot = timetable.slots[entry.slotIndex];
    const confirmation = await Swal.fire({
      title: 'Cancel this replacement?',
      text: `${slot?.subjectName ?? 'Class'} · ${entry.date.slice(0, 10)}`,
      input: 'text',
      inputLabel: 'Cancellation reason',
      inputPlaceholder: 'Enter a reason',
      showCancelButton: true,
      confirmButtonText: 'Cancel replacement',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) =>
        !value || value.trim().length < 3 ? 'Enter at least 3 characters' : undefined,
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation(`timetable/${timetable._id}/substitute/${entry._id}/cancel`, {
      method: 'POST',
      body: { reason: confirmation.value },
    });
    if (!(response as { results?: { success?: boolean } })?.results?.success) return;
    setSubstitutions((current) =>
      current.map((item) =>
        item._id === entry._id
          ? {
              ...item,
              status: 'cancelled',
              cancellationReason: String(confirmation.value),
            }
          : item,
      ),
    );
    toast.success('Replacement cancelled and faculty notified');
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label="Close class operations dialog"
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white "
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Extra Classes & Replacements</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Date-specific changes keep the published weekly timetable unchanged.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={createExtraClass}
            className="space-y-4 p-6 lg:border-r lg:border-slate-200"
          >
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Schedule an extra class</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Faculty, room, student-group, leave and attendance conflicts are checked before
                saving.
              </p>
            </div>
            <AsyncSelect
              label="Subject"
              type="subjects"
              params={{ curriculumId, semesterNo: timetable.semester }}
              value={values.subjectId || null}
              onChange={(subjectId) =>
                setValues((current) => ({ ...current, subjectId: subjectId ?? '' }))
              }
              required
              placeholder="Search curriculum subjects"
            />
            <AsyncSelect
              label="Faculty"
              type="faculty"
              params={{
                includeAllTeachingFaculty: true,
                academicYear: timetable.academicYear,
                semesterType: timetable.semesterType,
                startTime: values.startTime,
                endTime: values.endTime,
              }}
              value={values.facultyId || null}
              onChange={(facultyId) =>
                setValues((current) => ({ ...current, facultyId: facultyId ?? '' }))
              }
              required
              placeholder="Search available teaching faculty"
            />
            <AsyncSelect
              label="Classroom / Laboratory"
              type="facilitySpaces"
              value={values.roomId || null}
              onChange={(roomId, option) =>
                setValues((current) => ({
                  ...current,
                  roomId: roomId ?? '',
                  roomNo: option?.label.split(' — ')[0] ?? '',
                }))
              }
              required
              placeholder="Search an active facility"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Date <span className="text-red-500">*</span>
                <input
                  type="date"
                  required
                  className={fieldClass}
                  value={values.date}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Start time <span className="text-red-500">*</span>
                <input
                  type="time"
                  required
                  className={fieldClass}
                  value={values.startTime}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, startTime: event.target.value }))
                  }
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                End time <span className="text-red-500">*</span>
                <input
                  type="time"
                  required
                  className={fieldClass}
                  value={values.endTime}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, endTime: event.target.value }))
                  }
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Reason <span className="text-red-500">*</span>
              <textarea
                required
                rows={3}
                value={values.reason}
                onChange={(event) =>
                  setValues((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="Makeup class, syllabus recovery, revision…"
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div className="flex justify-end">
              <CustomButton
                type="submit"
                startIcon={<CalendarPlus className="h-4 w-4" />}
                loading={isLoading}
                className="w-fit!"
              >
                Schedule Extra Class
              </CustomButton>
            </div>
          </form>

          <section className="p-6">
            <h3 className="text-sm font-semibold text-slate-900">Operational history</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Scheduled and cancelled extra classes are retained for audit.
            </p>
            <div className="mt-4 space-y-3">
              {substitutions.map((entry) => {
                const slot = timetable.slots[entry.slotIndex];
                const facultyName =
                  typeof entry.substituteFacultyId === 'object'
                    ? entry.substituteFacultyId.name
                    : 'Replacement faculty';
                return (
                  <article
                    key={entry._id}
                    className="rounded-xl border border-violet-100 bg-violet-50/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Replacement · {slot?.subjectName ?? 'Timetable class'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.date.slice(0, 10)} · {slot?.startTime}–{slot?.endTime}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{facultyName}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${entry.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-violet-100 text-violet-700'}`}
                      >
                        {entry.status === 'cancelled' ? 'cancelled' : 'active'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{entry.reason}</p>
                    {entry.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => cancelSubstitute(entry)}
                        className="mt-3 text-xs font-semibold text-red-600 hover:underline"
                      >
                        Cancel replacement
                      </button>
                    )}
                  </article>
                );
              })}
              {operationsLoading && <p className="text-sm text-slate-600">Loading history…</p>}
              {!operationsLoading && operations.length === 0 && substitutions.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-600">
                  No extra classes have been scheduled.
                </div>
              )}
              {operations.map((operation) => (
                <article
                  key={operation._id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {operation.subjectCode} · {operation.subjectName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {operation.date.slice(0, 10)} · {operation.startTime}–{operation.endTime}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {operation.facultyName} · {operation.roomNo}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${operation.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {operation.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{operation.reason}</p>
                  {operation.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() => cancelExtraClass(operation)}
                      className="mt-3 text-xs font-semibold text-red-600 hover:underline"
                    >
                      Cancel extra class
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

interface IAutoGenerateValues {
  sectionId: string;
  subjects: Array<{
    subjectId: string;
    facultyId: string;
    roomId?: string;
    roomNo: string;
    classType: 'theory' | 'lab' | 'tutorial';
    periodsPerWeek: number;
  }>;
  periodTimings: Array<{ periodNo: number; startTime: string; endTime: string }>;
  workingDays: TDay[];
  generationRules: {
    maxFacultyPeriodsPerDay: number;
    maxSubjectPeriodsPerDay: number;
  };
}

/**
 * Collects auto-generation criteria using human-readable master-data selectors.
 */
export function AutoGenerateModal({
  loading,
  onClose,
  onGenerate,
}: {
  loading: boolean;
  onClose: () => void;
  onGenerate: (values: IAutoGenerateValues) => Promise<void>;
}) {
  const [values, setValues] = useState<IAutoGenerateValues>({
    sectionId: '',
    subjects: [
      {
        subjectId: '',
        facultyId: '',
        roomNo: '',
        classType: 'theory',
        periodsPerWeek: 3,
      },
    ],
    periodTimings: [
      { periodNo: 1, startTime: '09:00', endTime: '09:50' },
      { periodNo: 2, startTime: '09:50', endTime: '10:40' },
      { periodNo: 3, startTime: '10:55', endTime: '11:45' },
      { periodNo: 4, startTime: '11:45', endTime: '12:35' },
      { periodNo: 5, startTime: '13:20', endTime: '14:10' },
      { periodNo: 6, startTime: '14:10', endTime: '15:00' },
      { periodNo: 7, startTime: '15:10', endTime: '16:00' },
    ],
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    generationRules: {
      maxFacultyPeriodsPerDay: 4,
      maxSubjectPeriodsPerDay: 1,
    },
  });
  const valid =
    Boolean(values.sectionId) &&
    values.subjects.length > 0 &&
    values.subjects.every(
      (subject) =>
        subject.subjectId &&
        subject.facultyId &&
        subject.roomNo.trim() &&
        subject.periodsPerWeek > 0,
    );

  const updateSubject = (
    index: number,
    patch: Partial<IAutoGenerateValues['subjects'][number]>,
  ) => {
    setValues((current) => ({
      ...current,
      subjects: current.subjects.map((subject, subjectIndex) =>
        subjectIndex === index ? { ...subject, ...patch } : subject,
      ),
    }));
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label="Close auto-generation dialog"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative z-10 max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Auto-generate timetables</h2>
        <p className="mt-1 text-sm text-slate-500">
          Select a class, assign its curriculum subjects to faculty and rooms, then generate a
          conflict-checked draft timetable.
        </p>
        <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-700">
          Academic year, programme, branch, semester and odd/even term are taken automatically from
          the selected class section. No database IDs are required.
        </div>
        <div className="mt-5 space-y-4">
          <AsyncSelect
            label="Class Section"
            type="sections"
            params={{ master: true }}
            value={values.sectionId || null}
            onChange={(sectionId) =>
              setValues((current) => ({
                ...current,
                sectionId: sectionId ?? '',
                subjects: current.subjects.map((subject) => ({ ...subject, subjectId: '' })),
              }))
            }
            required
            placeholder="Search programme, branch, semester or section…"
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Teaching assignments</p>
                <p className="text-xs text-slate-500">
                  Add every curriculum subject that must appear in the weekly timetable.
                </p>
              </div>
              <CustomButton
                type="button"
                variant="tertiary"
                startIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    subjects: [
                      ...current.subjects,
                      {
                        subjectId: '',
                        facultyId: '',
                        roomId: '',
                        roomNo: '',
                        classType: 'theory',
                        periodsPerWeek: 3,
                      },
                    ],
                  }))
                }
              >
                Add Subject
              </CustomButton>
            </div>
            {values.subjects.map((subject, index) => (
              <div
                key={index}
                className="grid items-center gap-2.5 rounded-xl bg-slate-50 p-3 grid-cols-1 md:grid-cols-[1.5fr_1.3fr_1.1fr_1fr_75px_auto]"
              >
                <AsyncSelect
                  type="subjects"
                  params={{ sectionId: values.sectionId }}
                  disabled={!values.sectionId}
                  value={subject.subjectId || null}
                  onChange={(subjectId) => updateSubject(index, { subjectId: subjectId ?? '' })}
                  placeholder={values.sectionId ? 'Curriculum subject…' : 'Select class first'}
                />
                <AsyncSelect
                  type="faculty"
                  value={subject.facultyId || null}
                  onChange={(facultyId) => updateSubject(index, { facultyId: facultyId ?? '' })}
                  placeholder="Faculty…"
                />
                <AsyncSelect
                  type="facilitySpaces"
                  params={{ spaceType: subject.classType === 'lab' ? 'laboratory' : undefined }}
                  value={subject.roomId || null}
                  onChange={(roomId, option) =>
                    updateSubject(index, {
                      roomId: roomId ?? '',
                      roomNo: option?.label.split(' — ')[0] ?? '',
                    })
                  }
                  placeholder="Search room…"
                />
                <select
                  value={subject.classType}
                  onChange={(event) =>
                    updateSubject(index, {
                      classType: event.target.value as 'theory' | 'lab' | 'tutorial',
                    })
                  }
                  className="h-10.5 rounded-lg bg-white px-3 text-sm text-slate-700 outline-none ring-1 ring-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="theory">Theory</option>
                  <option value="lab">Lab</option>
                  <option value="tutorial">Tutorial</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={subject.periodsPerWeek}
                  onChange={(event) =>
                    updateSubject(index, { periodsPerWeek: Number(event.target.value) })
                  }
                  aria-label="Periods per week"
                  className="h-10.5 rounded-lg bg-white px-3 text-center text-sm text-slate-700 outline-none ring-1 ring-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <button
                  type="button"
                  aria-label={`Remove teaching assignment ${index + 1}`}
                  disabled={values.subjects.length === 1}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      subjects: current.subjects.filter(
                        (_, subjectIndex) => subjectIndex !== index,
                      ),
                    }))
                  }
                  className="flex h-10.5 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Maximum faculty periods per day
              <input
                type="number"
                min={1}
                max={10}
                value={values.generationRules.maxFacultyPeriodsPerDay}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    generationRules: {
                      ...current.generationRules,
                      maxFacultyPeriodsPerDay: Number(event.target.value),
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-primary"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Maximum same-subject periods per day
              <input
                type="number"
                min={1}
                max={5}
                value={values.generationRules.maxSubjectPeriodsPerDay}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    generationRules: {
                      ...current.generationRules,
                      maxSubjectPeriodsPerDay: Number(event.target.value),
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-primary"
              />
            </label>
          </div>
          <details className="rounded-xl bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Period timings ({values.periodTimings.length})
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {values.periodTimings.map((period, index) => (
                <div key={period.periodNo} className="rounded-lg bg-white p-2">
                  <p className="mb-1 text-xs font-medium text-slate-500">
                    Period {period.periodNo}
                  </p>
                  <div className="flex gap-1">
                    <input
                      type="time"
                      value={period.startTime}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          periodTimings: current.periodTimings.map((item, periodIndex) =>
                            periodIndex === index
                              ? { ...item, startTime: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      className="min-w-0 flex-1 bg-transparent text-xs"
                    />
                    <input
                      type="time"
                      value={period.endTime}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          periodTimings: current.periodTimings.map((item, periodIndex) =>
                            periodIndex === index ? { ...item, endTime: event.target.value } : item,
                          ),
                        }))
                      }
                      className="min-w-0 flex-1 bg-transparent text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <CustomButton variant="cancel" type="button" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton
            type="button"
            loading={loading}
            disabled={!valid}
            onClick={() => onGenerate(values)}
          >
            Generate Timetables
          </CustomButton>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Quick Lookup (class/faculty) ────────────────────────────────────────────
export function QuickLookup({ onPick }: { onPick: (t: ITimetable) => void }) {
  const { mutation: lookupTimetable } = useMutation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'class' | 'faculty'>('class');
  const [busy, setBusy] = useState(false);
  const [classForm, setClassForm] = useState({
    academicYear: '',
    semesterType: 'odd',
    departmentId: '',
    semester: 1,
    section: '',
  });
  const [facultyForm, setFacultyForm] = useState({
    facultyId: '',
    academicYear: '',
    semesterType: 'odd',
  });

  const run = async () => {
    setBusy(true);
    try {
      const qp = new URLSearchParams();
      const body = mode === 'class' ? classForm : facultyForm;
      Object.entries(body).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) qp.set(k, String(v));
      });
      const response = await lookupTimetable(`timetable/${mode}?${qp.toString()}`, {
        method: 'GET',
        silentError: true,
      });
      const json = response?.results as
        | {
            success?: boolean;
            data?: ITimetable | ITimetable[];
          }
        | undefined;
      const data = json?.data;
      const picked = Array.isArray(data) ? data[0] : data;
      if (!picked) {
        toast.info('No timetable found for the given criteria');
        return;
      }
      onPick(picked);
      setOpen(false);
    } catch {
      toast.error('Lookup failed');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:outline-none';

  return (
    <div className="relative ml-auto">
      <CustomButton
        type="button"
        variant="tertiary"
        startIcon={<Search className="h-3.5 w-3.5" />}
        onClick={() => setOpen((o) => !o)}
        className="py-1.5! text-xs! w-fit!"
      >
        Quick Lookup
      </CustomButton>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl bg-white p-4  ring-1 ring-slate-100">
          <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('class')}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${mode === 'class' ? 'bg-white text-primary ' : 'text-slate-500'}`}
            >
              <GraduationCap className="mr-1 inline h-3 w-3" /> Class
            </button>
            <button
              type="button"
              onClick={() => setMode('faculty')}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${mode === 'faculty' ? 'bg-white text-primary ' : 'text-slate-500'}`}
            >
              <User className="mr-1 inline h-3 w-3" /> Faculty
            </button>
          </div>
          {mode === 'class' ? (
            <div className="space-y-2">
              <AsyncSelect
                type="academicYears"
                value={classForm.academicYear || null}
                onChange={(value) => setClassForm({ ...classForm, academicYear: value ?? '' })}
                placeholder="Select configured academic year"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={inputCls}
                  value={classForm.semesterType}
                  onChange={(e) => setClassForm({ ...classForm, semesterType: e.target.value })}
                >
                  <option value="odd">Odd</option>
                  <option value="even">Even</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={8}
                  className={inputCls}
                  value={classForm.semester}
                  onChange={(e) => setClassForm({ ...classForm, semester: Number(e.target.value) })}
                />
              </div>
              <AsyncSelect
                type="departments"
                value={classForm.departmentId || null}
                onChange={(value) => setClassForm({ ...classForm, departmentId: value ?? '' })}
                placeholder="Select department…"
              />
              <input
                className={`${inputCls} w-full`}
                placeholder="Section (A/B/C)"
                value={classForm.section}
                onChange={(e) => setClassForm({ ...classForm, section: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <AsyncSelect
                type="faculty"
                value={facultyForm.facultyId || null}
                onChange={(value) => setFacultyForm({ ...facultyForm, facultyId: value ?? '' })}
                placeholder="Search faculty…"
              />
              <input
                className={`${inputCls} w-full`}
                placeholder="Academic Year"
                value={facultyForm.academicYear}
                onChange={(e) => setFacultyForm({ ...facultyForm, academicYear: e.target.value })}
              />
              <select
                className={`${inputCls} w-full`}
                value={facultyForm.semesterType}
                onChange={(e) => setFacultyForm({ ...facultyForm, semesterType: e.target.value })}
              >
                <option value="odd">Odd</option>
                <option value="even">Even</option>
              </select>
            </div>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <CustomButton
              variant="cancel"
              type="button"
              onClick={() => setOpen(false)}
              className="py-1.5! text-xs!"
            >
              Close
            </CustomButton>
            <CustomButton type="button" loading={busy} onClick={run} className="py-1.5! text-xs!">
              Load
            </CustomButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default UseProtectedRoutes(TimetablePage, [
  'super_admin',
  'admin',
  'principal',
  'dean_academic',
  'hod',
  'faculty',
  'student',
  'parent',
]);

/**
 * @file ShortageListPanel.tsx
 * @description Shortage list report for HODs and administrators with lock controls and CSV export.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import type { IShortage } from '../../types/attendance.types';
import { currentAcademicYear, downloadCsv } from '../../utils/attendance.helpers';
import AcademicYearSelect from '../common/AcademicYearSelect';

export function ShortageListPanel({ canLock, canExport }: { canLock: boolean; canExport: boolean }) {
  const [semester, setSemester] = useState(1);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [queryParams, setQueryParams] = useState(
    `semester=1&academicYear=${currentAcademicYear()}`,
  );

  const { data: raw, isLoading } = useSwr(`attendance/shortage?${queryParams}`);
  const list: IShortage[] = (raw as { data?: IShortage[] })?.data ?? [];
  const { mutation, isLoading: locking } = useMutation();

  const search = () => setQueryParams(`semester=${semester}&academicYear=${academicYear}`);

  const handleLockOld = async () => {
    const r = await Swal.fire({
      title: 'Lock records older than 24h?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Lock',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation('attendance/lock', { method: 'POST', body: {}, isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success)
      toast.success('Old records locked');
    else toast.error('Failed');
  };

  const handleLockSemester = async () => {
    const r = await Swal.fire({
      title: `Lock all attendance for ${academicYear}?`,
      text: 'This is permanent and cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Confirm Lock',
      confirmButtonColor: '#dc2626',
    });
    if (!r.isConfirmed) return;
    const res = await mutation('attendance/lock-semester', {
      method: 'POST',
      body: { academicYear },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success)
      toast.success('Semester attendance locked');
    else toast.error('Failed');
  };

  const columns: Column<IShortage>[] = [
    {
      field: 'rollNo',
      title: 'Roll No.',
      render: (r) => <span className="font-mono text-sm">{String(r.rollNo ?? '—')}</span>,
    },
    {
      field: 'studentName',
      title: 'Student',
      render: (r) => <span className="text-sm">{String(r.studentName ?? '—')}</span>,
    },
    {
      field: 'program',
      title: 'Program',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {String(r.program ?? '—')} {r.branch ? `/ ${String(r.branch)}` : ''}
        </span>
      ),
    },
    {
      field: 'subjectCode',
      title: 'Subject',
      render: (r) => (
        <div>
          <p className="text-sm font-mono">{String(r.subjectCode ?? '—')}</p>
          <p className="text-xs text-slate-600">{String(r.subjectName ?? '')}</p>
        </div>
      ),
    },
    {
      field: 'attended',
      title: 'Classes',
      render: (r) => (
        <span className="text-sm">
          {r.attended}/{r.totalClasses}
        </span>
      ),
    },
    {
      field: 'percentage',
      title: 'Attendance %',
      render: (r) => {
        const pct = Math.round(r.percentage);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 max-w-16">
              <div
                className={`h-1.5 rounded-full ${pct < 60 ? 'bg-red-400' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${pct < 60 ? 'text-red-500' : 'text-amber-600'}`}>
              {pct}%
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Filters Grid ── */}
      <div className="grid grid-cols-1 items-end gap-4 rounded-2xl bg-white p-4 sm:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Semester
          </label>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>
        <AcademicYearSelect value={academicYear} onChange={setAcademicYear} />
        <div>
          <CustomButton
            variant="primary"
            onClick={search}
            className="w-full h-9 flex items-center justify-center"
          >
            Search Shortage
          </CustomButton>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white">
        <CustomTable<IShortage>
          title="Attendance Shortage List"
          description="Identify and manage students with attendance below the required threshold"
          data={list}
          columns={columns}
          isLoading={isLoading}
          options={{ search: true, pagination: true, pageSize: 20, export: false }}
          localization={{ toolbar: { searchPlaceholder: 'Search students…' } }}
          customActions={
            <div className="flex items-center gap-2.5 whitespace-nowrap">
              {canExport && (
                <CustomButton
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onClick={() =>
                    downloadCsv(
                      `attendance-shortage-sem-${semester}-${academicYear}.csv`,
                      [
                        'Roll Number',
                        'Student',
                        'Subject',
                        'Attended',
                        'Total Classes',
                        'Percentage',
                      ],
                      list.map((row) => [
                        row.rollNo ?? '',
                        row.studentName ?? '',
                        row.subjectCode ?? '',
                        row.attended,
                        row.totalClasses,
                        Math.round(row.percentage),
                      ]),
                    )
                  }
                  disabled={!list.length}
                  startIcon={<Download className="h-4 w-4" />}
                  className="w-fit! bg-emerald-50! text-emerald-700! border-emerald-200! hover:bg-emerald-100! hover:text-emerald-800! transition"
                >
                  Export CSV
                </CustomButton>
              )}
              {canLock && (
                <CustomButton
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onClick={handleLockOld}
                  loading={locking}
                  startIcon={<Lock className="h-4 w-4" />}
                  className="w-fit! bg-amber-50! text-amber-700! border-amber-200! hover:bg-amber-100! hover:text-amber-800! transition"
                >
                  Lock Old (&gt;24h)
                </CustomButton>
              )}
              {canLock && (
                <CustomButton
                  variant="primary"
                  size="sm"
                  fullWidth={false}
                  onClick={handleLockSemester}
                  loading={locking}
                  startIcon={<Lock className="h-4 w-4" />}
                  className="w-fit! bg-red-600! text-white! border-red-700! hover:bg-red-700! transition"
                >
                  Lock Semester
                </CustomButton>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}

export default ShortageListPanel;

/**
 * @file StudentSummaryPanel.tsx
 * @description Student personal attendance summary and subject-wise breakdown panel.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import type { IAttendanceSummary } from '../../types/attendance.types';
import { currentAcademicYear } from '../../utils/attendance.helpers';
import AcademicYearSelect from '../common/AcademicYearSelect';
import AttendanceCardsSkeleton from '../common/AttendanceCardsSkeleton';

export function StudentSummaryPanel() {
  const [semester, setSemester] = useState(1);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [queryParams, setQueryParams] = useState(
    `semester=1&academicYear=${currentAcademicYear()}`,
  );

  const { data: raw, isLoading } = useSwr(`attendance/my/summary?${queryParams}`);
  const summary: IAttendanceSummary[] = (raw as { data?: IAttendanceSummary[] })?.data ?? [];

  const search = () => setQueryParams(`semester=${semester}&academicYear=${academicYear}`);
  const overall = summary.length
    ? Math.round(summary.reduce((s, r) => s + r.percentage, 0) / summary.length)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-white p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Sem</label>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <AcademicYearSelect value={academicYear} onChange={setAcademicYear} className="min-w-56" />
        <CustomButton variant="primary" onClick={search} className="py-1.5! text-xs! w-fit!">
          Load
        </CustomButton>
      </div>

      {isLoading ? (
        <AttendanceCardsSkeleton cards={4} />
      ) : summary.length ? (
        <>
          {/* Overall */}
          <div className="flex items-center gap-4 rounded-2xl bg-white p-5">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-xl text-xl font-black ${
                overall >= 75
                  ? 'bg-green-50 text-green-600'
                  : overall >= 65
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-red-50 text-red-500'
              }`}
            >
              {overall}%
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">Overall Attendance</p>
              <p className="text-xs text-slate-600">
                Across {summary.length} subject{summary.length > 1 ? 's' : ''}
              </p>
              {overall < 75 && (
                <p className="text-xs text-red-500 mt-0.5">⚠ Below 75% minimum requirement</p>
              )}
            </div>
          </div>

          {/* Per subject */}
          <div className="grid gap-3 sm:grid-cols-2">
            {summary.map((s, i) => {
              const pct = Math.round(s.percentage);
              const barColor =
                pct >= 75 ? 'bg-green-400' : pct >= 65 ? 'bg-amber-400' : 'bg-red-400';
              const textColor =
                pct >= 75 ? 'text-green-600' : pct >= 65 ? 'text-amber-600' : 'text-red-500';
              return (
                <motion.div
                  key={s.subjectCode}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl bg-white p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {s.subjectName ?? s.subjectCode}
                      </p>
                      <p className="text-xs text-slate-600 font-mono">{s.subjectCode}</p>
                    </div>
                    <span className={`text-lg font-black ${textColor}`}>{pct}%</span>
                  </div>
                  <div className="mb-2 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span className="text-green-600">Present: {s.attended}</span>
                    <span className="text-red-400">Absent: {s.absent}</span>
                    <span className="text-amber-500">Late: {s.late}</span>
                    <span>Total: {s.totalClasses}</span>
                  </div>
                  {pct < 75 && (
                    <p className="mt-2 text-xs text-red-500">
                      Need {Math.ceil(s.totalClasses * 0.75) - s.attended} more classes to reach 75%
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16">
          <BarChart2 className="h-10 w-10 text-slate-200 mb-2" />
          <p className="text-sm text-slate-600">No attendance data for selected filters</p>
        </div>
      )}
    </div>
  );
}

export default StudentSummaryPanel;

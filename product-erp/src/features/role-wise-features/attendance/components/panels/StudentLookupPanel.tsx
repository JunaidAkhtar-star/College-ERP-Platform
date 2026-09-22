/**
 * @file StudentLookupPanel.tsx
 * @description Student attendance lookup panel for faculty and administrators to inspect individual student profiles.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import { BookOpen, Users } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import { useHasRole, useHasAnyRole } from '@/shared/hooks/useHasRole';
import { TSystemRole } from '@/shared/types';
import type { IAttendanceSummary } from '../../types/attendance.types';
import { ANALYTICS_ROLES } from '../../utils/attendance.constants';
import { currentAcademicYear } from '../../utils/attendance.helpers';
import AcademicYearSelect from '../common/AcademicYearSelect';
import AttendanceCardsSkeleton from '../common/AttendanceCardsSkeleton';

export function StudentLookupPanel() {
  const isHod = useHasRole('hod');
  const isAnalytics = useHasAnyRole(ANALYTICS_ROLES as TSystemRole[]);
  const [studentId, setStudentId] = useState('');
  const [semester, setSemester] = useState(1);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const { data, isLoading } = useSwr<{ data?: IAttendanceSummary[] }>(
    studentId
      ? `attendance/student/${studentId}/summary?semester=${semester}&academicYear=${academicYear}`
      : null,
  );
  const rows = [
    ...(Array.isArray(data) ? data : ((data as { data?: IAttendanceSummary[] })?.data ?? [])),
  ].sort((left, right) => right.percentage - left.percentage);
  const totalClasses = rows.reduce((sum, row) => sum + row.totalClasses, 0);
  const totalAttended = rows.reduce((sum, row) => sum + row.attended, 0);
  const totalAbsent = rows.reduce((sum, row) => sum + row.absent, 0);
  const totalLate = rows.reduce((sum, row) => sum + row.late, 0);
  const overallPercentage = totalClasses ? Math.round((totalAttended / totalClasses) * 100) : 0;
  const attentionSubjects = rows.filter((row) => row.percentage < 75).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Student attendance intelligence
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Individual attendance profile</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Review subject-level participation and identify attendance risks for one student.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:w-3xl xl:grid-cols-[minmax(16rem,1fr)_10rem_14rem]">
            <AsyncSelect
              type="students"
              label="Student"
              params={
                isHod || isAnalytics
                  ? { assignmentScopeVersion: 2 }
                  : { assignedOnly: true, assignmentScopeVersion: 2 }
              }
              value={studentId}
              onChange={(value) => setStudentId(value ?? '')}
              placeholder={isHod ? 'Search any department student' : 'Search assigned student'}
              emptyMessage={
                isHod
                  ? 'No students found in your department.'
                  : 'No active students are allotted to your assigned timetable classes.'
              }
            />
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Semester
              </label>
              <select
                value={semester}
                onChange={(event) => setSemester(Number(event.target.value))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                  <option key={value} value={value}>
                    Semester {value}
                  </option>
                ))}
              </select>
            </div>
            <AcademicYearSelect value={academicYear} onChange={setAcademicYear} />
          </div>
        </div>
      </section>

      {!studentId && (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-base font-bold text-slate-900">Select a student</h3>
          <p className="mt-1 text-sm text-slate-500">
            The attendance profile will load automatically after selection.
          </p>
        </section>
      )}

      {isLoading && studentId && <AttendanceCardsSkeleton cards={4} />}

      {studentId && !isLoading && rows.length === 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-base font-bold text-slate-900">No attendance summary found</h3>
          <p className="mt-1 text-sm text-slate-500">Try another semester or academic year.</p>
        </section>
      )}

      {rows.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center border-b border-slate-200 bg-blue-50/50 p-6 text-center lg:border-b-0 lg:border-r">
              <div className="relative flex size-44 items-center justify-center">
                <svg
                  viewBox="0 0 120 120"
                  className="absolute inset-0 -rotate-90"
                  aria-hidden="true"
                >
                  <circle cx="60" cy="60" r="46" fill="none" stroke="#dbe5f1" strokeWidth="9" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke={
                      overallPercentage < 75
                        ? '#fb7185'
                        : overallPercentage < 85
                          ? '#f59e0b'
                          : '#0878da'
                    }
                    strokeWidth="9"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray={`${overallPercentage} 100`}
                    initial={{ strokeDashoffset: 100 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                </svg>
                <div>
                  <strong className="block text-4xl font-black text-slate-900">
                    {overallPercentage}%
                  </strong>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Overall
                  </span>
                </div>
              </div>
              <span
                className={`mt-2 rounded-lg px-3 py-1 text-xs font-bold ${overallPercentage < 75 ? 'bg-rose-100 text-rose-700' : overallPercentage < 85 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
              >
                {overallPercentage < 75
                  ? 'Below requirement'
                  : overallPercentage < 85
                    ? 'Monitor attendance'
                    : 'Attendance is healthy'}
              </span>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                    Selected period
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    Semester {semester} attendance overview
                  </h3>
                </div>
                <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  {academicYear}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Classes', value: totalClasses, color: 'text-slate-900' },
                  { label: 'Attended', value: totalAttended, color: 'text-emerald-700' },
                  { label: 'Absent', value: totalAbsent, color: 'text-rose-600' },
                  { label: 'Late', value: totalLate, color: 'text-amber-600' },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <strong className={`block text-xl font-black ${metric.color}`}>
                      {metric.value}
                    </strong>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {metric.label}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className={`mt-4 rounded-xl border px-4 py-3 text-sm ${attentionSubjects ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
              >
                <strong>
                  {attentionSubjects
                    ? `${attentionSubjects} ${attentionSubjects === 1 ? 'subject needs' : 'subjects need'} attention.`
                    : 'All subjects meet the attendance requirement.'}
                </strong>
                <span className="mt-1 block text-xs font-normal">
                  The minimum reference line is 75% attendance.
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200">
            <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4 sm:px-6">
              <div>
                <h3 className="font-bold text-slate-900">Subject performance</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Detailed attendance with a visible 75% requirement marker
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{rows.length} subjects</span>
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map((row, index) => {
                const cappedPercentage = Math.max(0, Math.min(100, row.percentage));
                const tone =
                  row.percentage < 75 ? '#fb7185' : row.percentage < 85 ? '#f59e0b' : '#10b981';
                return (
                  <motion.article
                    key={`${row.subjectId || row.subjectCode || 'unlinked-subject'}-${index}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.24) }}
                    className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(14rem,1fr)_minmax(18rem,1.2fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold text-primary">
                        {row.subjectCode}
                      </p>
                      <h4 className="mt-1 wrap-break-word text-sm font-bold text-slate-900">
                        {row.subjectName || 'Subject name unavailable'}
                      </h4>
                    </div>
                    <div>
                      <svg
                        viewBox="0 0 300 32"
                        className="h-9 w-full"
                        role="img"
                        aria-label={`${row.subjectCode} attendance ${row.percentage.toFixed(1)} percent`}
                      >
                        <rect x="0" y="9" width="300" height="14" rx="7" fill="#e8edf4" />
                        <line
                          x1="225"
                          y1="4"
                          x2="225"
                          y2="28"
                          stroke="#64748b"
                          strokeWidth="2"
                          strokeDasharray="3 3"
                        />
                        <motion.rect
                          x="0"
                          y="9"
                          height="14"
                          rx="7"
                          fill={tone}
                          initial={{ width: 0 }}
                          animate={{ width: cappedPercentage * 3 }}
                          transition={{ duration: 0.75, delay: index * 0.05 }}
                        />
                      </svg>
                      <div className="flex justify-between text-[9px] font-semibold text-slate-600">
                        <span>0%</span>
                        <span>75% required</span>
                        <span>100%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-5 lg:justify-end">
                      <div className="flex gap-4 text-center">
                        <span>
                          <strong className="block text-sm text-emerald-700">{row.attended}</strong>
                          <small className="text-[9px] uppercase text-slate-600">Present</small>
                        </span>
                        <span>
                          <strong className="block text-sm text-rose-600">{row.absent}</strong>
                          <small className="text-[9px] uppercase text-slate-600">Absent</small>
                        </span>
                        <span>
                          <strong className="block text-sm text-slate-700">
                            {row.totalClasses}
                          </strong>
                          <small className="text-[9px] uppercase text-slate-600">Total</small>
                        </span>
                      </div>
                      <strong
                        className="w-16 text-right text-lg font-black"
                        style={{ color: tone }}
                      >
                        {row.percentage.toFixed(1)}%
                      </strong>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default StudentLookupPanel;

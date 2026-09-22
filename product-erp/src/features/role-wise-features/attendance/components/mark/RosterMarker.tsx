/**
 * @file RosterMarker.tsx
 * @description Attendance marking student roster with search, bulk-actions, and one-tap status toggles.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Search, Users } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import type { AttendanceStatus, ISelectedClass, IStudentLite } from '../../types/attendance.types';
import {
  inputCls,
  STATUS_COLORS,
  STATUS_DOT_COLORS,
  STATUS_INACTIVE,
  STATUS_LABELS,
  STATUS_ROW_TONES,
  STATUSES,
} from '../../utils/attendance.constants';

export interface RosterMarkerProps {
  cls: ISelectedClass;
  date: string;
  setDate: (d: string) => void;
  students: IStudentLite[];
  loading: boolean;
  statusMap: Record<string, AttendanceStatus>;
  remarksMap: Record<string, string>;
  setStatus: (sid: string, st: AttendanceStatus) => void;
  setRemarks: (sid: string, r: string) => void;
  bulkMark: (st: AttendanceStatus) => void;
  isEditing: boolean;
  counts: { P: number; A: number; L: number; other: number };
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  onRetry: () => void;
}

export function RosterMarker({
  cls,
  date,
  setDate,
  students,
  loading,
  statusMap,
  remarksMap,
  setStatus,
  setRemarks,
  bulkMark,
  isEditing,
  counts,
  onBack,
  onSubmit,
  submitting,
  onRetry,
}: RosterMarkerProps) {
  const [search, setSearch] = useState('');
  const attendanceRate = students.length ? Math.round((counts.P / students.length) * 100) : 0;

  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.rollNumber ?? '').toLowerCase().includes(q) ||
      (s.fullName ?? s.name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" /> Back to classes
          </button>
        </div>
        <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{cls.subjectName}</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                {cls.classType}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              <span className="font-mono font-semibold text-slate-700">{cls.subjectCode}</span>
              <span className="mx-2 text-slate-300">•</span>
              {cls.program}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Semester {cls.semester}</span>
              {cls.section ? (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Section {cls.section}</span>
              ) : null}
              {cls.branch && cls.branch !== cls.program ? (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Branch {cls.branch}</span>
              ) : null}
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                Period {cls.periodNumber} · {cls.startTime}–{cls.endTime}
              </span>
            </div>
          </div>
          <label className="block min-w-44">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">
              Attendance date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls + ' bg-white'}
            />
          </label>
        </div>

        {students.length > 0 && (
          <div className="grid border-t border-slate-100 sm:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
              {[
                { label: 'Present', value: counts.P, tone: 'text-emerald-600' },
                { label: 'Absent', value: counts.A, tone: 'text-rose-600' },
                { label: 'Late', value: counts.L, tone: 'text-amber-600' },
                { label: 'Attendance', value: `${attendanceRate}%`, tone: 'text-blue-600' },
              ].map((metric) => (
                <div key={metric.label} className="px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {metric.label}
                  </p>
                  <p className={`mt-0.5 text-lg font-bold ${metric.tone}`}>{metric.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 sm:border-l sm:border-t-0">
              <span className="mr-1 text-xs font-semibold text-slate-500">Mark everyone</span>
              <button
                type="button"
                onClick={() => bulkMark('P')}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                Present
              </button>
              <button
                type="button"
                onClick={() => bulkMark('A')}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
              >
                Absent
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-3">
        {[
          { step: '01', title: 'Class selected', detail: cls.subjectCode, complete: true },
          {
            step: '02',
            title: 'Mark the roster',
            detail: `${students.length} students`,
            complete: students.length > 0,
          },
          {
            step: '03',
            title: 'Review and submit',
            detail: 'Final confirmation',
            complete: false,
          },
        ].map((item, index) => (
          <div
            key={item.step}
            className={`flex items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                item.complete ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {item.step}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-800">{item.title}</p>
              <p className="truncate text-[11px] text-slate-500">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Class roster</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {filtered.length} of {students.length} students shown
            </p>
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roll no. or name…"
              className={inputCls + ' bg-white pl-9 sm:ml-auto sm:max-w-sm'}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500 sm:px-5">
          <span className="font-bold uppercase tracking-wider text-slate-600">Status guide</span>
          {STATUSES.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />
              <strong className="text-slate-700">{status}</strong> {STATUS_LABELS[status]}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2 p-4 sm:p-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No students found</p>
            <p className="mt-1 text-xs text-slate-600">
              No active students for {cls.program} · Sem {cls.semester}
              {cls.section ? ` · Sec ${cls.section}` : ''}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 text-xs font-medium text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-600">
            No students match “{search}”
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((s, i) => {
              const st = statusMap[s._id] ?? 'P';
              return (
                <li
                  key={s._id}
                  className={`grid gap-3 px-4 py-3 transition-colors sm:px-5 lg:grid-cols-[minmax(220px,1fr)_minmax(540px,auto)] lg:items-center ${STATUS_ROW_TONES[st]}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 text-right text-xs font-semibold text-slate-300">
                      {i + 1}
                    </span>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold text-primary">
                      {(s.fullName ?? s.name ?? '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {s.fullName ?? s.name ?? '—'}
                      </p>
                      <p className="font-mono text-[11px] text-slate-600">{s.rollNumber}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)] sm:items-center">
                    <div
                      className="grid grid-cols-3 gap-1.5 sm:grid-cols-6"
                      role="group"
                      aria-label={`Attendance status for ${s.fullName ?? s.name ?? 'student'}`}
                    >
                      {STATUSES.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setStatus(s._id, opt)}
                          aria-pressed={st === opt}
                          className={`min-h-10 rounded-lg px-2 text-[11px] font-bold transition-colors xl:text-xs ${
                            st === opt ? STATUS_COLORS[opt] : STATUS_INACTIVE
                          }`}
                          title={STATUS_LABELS[opt]}
                        >
                          <span className="xl:hidden">{opt}</span>
                          <span className="hidden xl:inline">{STATUS_LABELS[opt]}</span>
                        </button>
                      ))}
                    </div>
                    <input
                      value={remarksMap[s._id] ?? ''}
                      onChange={(e) => setRemarks(s._id, e.target.value)}
                      placeholder="Remarks"
                      className={inputCls + ' h-9 bg-white text-xs'}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {students.length > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="font-bold text-slate-800">Review attendance</p>
              <p className="text-slate-500">
                <span className="font-bold text-emerald-600">{counts.P} present</span> ·{' '}
                <span className="font-bold text-rose-600">{counts.A} absent</span> ·{' '}
                <span className="font-bold text-amber-600">{counts.L} late</span>
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
          </div>
          <CustomButton
            variant="primary"
            type="button"
            onClick={onSubmit}
            loading={submitting}
            startIcon={<CheckCircle className="h-4 w-4" />}
            className="w-full! sm:w-auto!"
          >
            {isEditing ? 'Update Attendance' : 'Submit Attendance'}
          </CustomButton>
        </div>
      )}
    </div>
  );
}

export default RosterMarker;

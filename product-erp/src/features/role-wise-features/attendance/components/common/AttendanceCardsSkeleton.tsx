/**
 * @file AttendanceCardsSkeleton.tsx
 * @description Loading skeleton for attendance cards and lists.
 * @module features/attendance
 */

'use client';

import React from 'react';

export function AttendanceCardsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading attendance information"
    >
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="size-12 rounded-xl bg-blue-50" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 rounded-full bg-slate-200" />
              <div className="h-4 w-3/5 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="mt-5 h-5 w-4/5 rounded-full bg-slate-200" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="h-10 rounded-xl bg-slate-100" />
            <div className="h-10 rounded-xl bg-slate-100" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="h-7 w-28 rounded-lg bg-emerald-50" />
            <div className="h-3 w-20 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default AttendanceCardsSkeleton;

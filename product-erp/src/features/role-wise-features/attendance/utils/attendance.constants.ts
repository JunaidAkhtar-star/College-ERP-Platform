/**
 * @file attendance.constants.ts
 * @description Role permissions, visual styles, month themes, and status labels for attendance.
 * @module features/attendance
 */

import type { AttendanceStatus, ClassType } from '../types/attendance.types';

// Analytics-only roles: read/oversight, NO marking, NO create/delete actions
export const ANALYTICS_ROLES = ['super_admin', 'principal', 'dean_academic'];
// Faculty roles: mark attendance + view their own records
export const FACULTY_ROLES = ['hod', 'faculty'];

export const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
export const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  M: 'Medical',
  OD: 'On Duty',
  H: 'Holiday',
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  P: 'bg-green-50 text-green-600 border border-green-200',
  A: 'bg-red-50 text-red-500 border border-red-200',
  L: 'bg-amber-50 text-amber-600 border border-amber-200',
  M: 'bg-blue-50 text-blue-600 border border-blue-200',
  OD: 'bg-purple-50 text-purple-600 border border-purple-200',
  H: 'bg-slate-100 text-slate-500 border border-slate-200',
};

export const STATUS_INACTIVE =
  'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50';

export const STATUS_ROW_TONES: Record<AttendanceStatus, string> = {
  P: 'bg-emerald-50/30',
  A: 'bg-rose-50/40',
  L: 'bg-amber-50/40',
  M: 'bg-blue-50/40',
  OD: 'bg-violet-50/40',
  H: 'bg-slate-50/80',
};

export const STATUS_DOT_COLORS: Record<AttendanceStatus, string> = {
  P: 'bg-emerald-500',
  A: 'bg-rose-500',
  L: 'bg-amber-500',
  M: 'bg-blue-500',
  OD: 'bg-violet-500',
  H: 'bg-slate-500',
};

export const CLASS_TYPES: ClassType[] = ['Lecture', 'Tutorial', 'Practical', 'Extra Class'];
export const STATUSES: AttendanceStatus[] = ['P', 'A', 'L', 'M', 'OD', 'H'];
export const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export interface IMonthTheme {
  border: string;
  bg: string;
  headerBg: string;
  headerText: string;
  numText: string;
}

export const MONTH_THEMES: Record<number, IMonthTheme> = {
  0: { // Jan
    border: 'border-sky-200',
    bg: 'bg-sky-50/60',
    headerBg: 'bg-sky-500',
    headerText: 'text-white',
    numText: 'text-sky-950',
  },
  1: { // Feb
    border: 'border-purple-200',
    bg: 'bg-purple-50/60',
    headerBg: 'bg-purple-500',
    headerText: 'text-white',
    numText: 'text-purple-950',
  },
  2: { // Mar
    border: 'border-teal-200',
    bg: 'bg-teal-50/60',
    headerBg: 'bg-teal-500',
    headerText: 'text-white',
    numText: 'text-teal-950',
  },
  3: { // Apr
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/60',
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
    numText: 'text-emerald-950',
  },
  4: { // May
    border: 'border-amber-200',
    bg: 'bg-amber-50/60',
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    numText: 'text-amber-950',
  },
  5: { // Jun
    border: 'border-orange-200',
    bg: 'bg-orange-50/60',
    headerBg: 'bg-orange-500',
    headerText: 'text-white',
    numText: 'text-orange-950',
  },
  6: { // Jul
    border: 'border-cyan-200',
    bg: 'bg-cyan-50/60',
    headerBg: 'bg-cyan-500',
    headerText: 'text-white',
    numText: 'text-cyan-950',
  },
  7: { // Aug
    border: 'border-indigo-200',
    bg: 'bg-indigo-50/60',
    headerBg: 'bg-indigo-500',
    headerText: 'text-white',
    numText: 'text-indigo-950',
  },
  8: { // Sep
    border: 'border-violet-200',
    bg: 'bg-violet-50/60',
    headerBg: 'bg-violet-500',
    headerText: 'text-white',
    numText: 'text-violet-950',
  },
  9: { // Oct
    border: 'border-rose-200',
    bg: 'bg-rose-50/60',
    headerBg: 'bg-rose-500',
    headerText: 'text-white',
    numText: 'text-rose-950',
  },
  10: { // Nov
    border: 'border-blue-200',
    bg: 'bg-blue-50/60',
    headerBg: 'bg-blue-500',
    headerText: 'text-white',
    numText: 'text-blue-950',
  },
  11: { // Dec
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/60',
    headerBg: 'bg-emerald-600',
    headerText: 'text-white',
    numText: 'text-emerald-950',
  },
};

export function getMonthTheme(date: Date): IMonthTheme {
  const month = date.getMonth();
  return MONTH_THEMES[month] ?? MONTH_THEMES[0];
}

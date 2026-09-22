/**
 * @file TimetableGrid.tsx
 * @description Google Calendar-style week grid for timetable display.
 * Time axis on left, days as columns, slots as positioned cards.
 * Meetings shown as overlay events. Click empty cell to add slot.
 * @module features/role-wise-features/timetable/components
 */
'use client';

import React, { useState, useMemo } from 'react';
import { UserCheck, Plus } from 'lucide-react';
import { Tooltip as MuiTooltip } from '@mui/material';
import { toast } from 'react-toastify';
import { motion } from '@/shared/utils/motion';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { ITimetable, TDay, ITimetableSlot } from '../types/timetable.types';

const DAYS: TDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_SHORT: Record<TDay, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
};

const CLASS_TYPE_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  theory: {
    bg: 'bg-blue-50/90 hover:bg-blue-100/90',
    border: 'border-blue-300/90',
    text: 'text-blue-900',
  },
  lab: {
    bg: 'bg-amber-50/90 hover:bg-amber-100/90',
    border: 'border-amber-300/90',
    text: 'text-amber-900',
  },
  tutorial: {
    bg: 'bg-purple-50/90 hover:bg-purple-100/90',
    border: 'border-purple-300/90',
    text: 'text-purple-900',
  },
  break: {
    bg: 'bg-slate-100/95 hover:bg-slate-200/95',
    border: 'border-slate-300',
    text: 'text-slate-700',
  },
  activity: {
    bg: 'bg-teal-50/95 hover:bg-teal-100/95',
    border: 'border-teal-300',
    text: 'text-teal-900',
  },
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
const MIN_HOUR_WIDTH = 300;
const MIN_GRID_WIDTH = 1800;
const ROW_HEIGHT = 120;
const MIN_BRANCH_LANE_HEIGHT = 84;
const DAY_GROUP_BORDER = 1;
const CARD_GUTTER = 5;

function dayGroupMetrics(branchCount: number) {
  const count = Math.max(1, branchCount);
  const height = Math.max(ROW_HEIGHT, count * MIN_BRANCH_LANE_HEIGHT + DAY_GROUP_BORDER);
  return { height, laneHeight: (height - DAY_GROUP_BORDER) / count };
}

function timeToMinutes(t: string): number {
  const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  return hour * 60 + minute;
}

function minutesToPxX(minutes: number, startHour: number, hourWidth: number): number {
  const relMinutes = minutes - startHour * 60;
  return (relMinutes / 60) * hourWidth;
}

function slotLeft(startTime: string, startHour: number, hourWidth: number): number {
  return minutesToPxX(timeToMinutes(startTime), startHour, hourWidth);
}

function slotWidth(startTime: string, endTime: string, hourWidth: number): number {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime);
  return (duration / 60) * hourWidth;
}

function formatTime12(t?: string): string {
  if (!t) return '';
  const trimmed = t.trim();
  if (trimmed.includes('AM') || trimmed.includes('PM')) return trimmed;
  const parts = trimmed.split(':');
  if (parts.length < 2) return trimmed;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return trimmed;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface IMeetingEvent {
  _id: string;
  title: string;
  scheduledAt: string; // ISO string
  durationMinutes?: number;
  meetingType: string;
  status: string;
}

interface IProps {
  timetable: ITimetable | null;
  meetings?: IMeetingEvent[];
  onAddSlot?: (
    day: TDay,
    clickedTime: string,
    branchDepartmentId?: string,
    branch?: string,
  ) => void;
  onEditSlot?: (slot: ITimetableSlot, index: number) => void;
  canAssignSubstitute?: boolean;
  onMutate: (updatedTimetable?: ITimetable) => void;
}

type TimetableLane = { key: string; code: string; departmentId: string; label: string };

// Day-of-week → TDay mapping
const JS_DOW_TO_DAY: Record<number, TDay> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export default function TimetableGrid({
  timetable,
  meetings = [],
  onAddSlot,
  onEditSlot,
  canAssignSubstitute = false,
  onMutate,
}: IProps) {
  const { mutation } = useMutation();
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const userDepartment = useAuthStore(
    (state) => state.user?.department ?? state.user?.departmentId,
  );
  const viewerDepartmentId =
    typeof userDepartment === 'object' && userDepartment && '_id' in userDepartment
      ? String((userDepartment as { _id: unknown })._id)
      : String(userDepartment ?? '');
  const hodDepartmentId = activeRole === 'hod' ? viewerDepartmentId : '';
  const sectionQuery = useMemo(() => {
    const selectedSectionId =
      typeof timetable?.sectionId === 'object' ? timetable.sectionId._id : timetable?.sectionId;
    if (
      !selectedSectionId ||
      !timetable?.academicYear ||
      !timetable.semester ||
      !timetable.branchDepartmentIds?.length
    )
      return null;
    const visibleDepartmentIds = hodDepartmentId
      ? timetable.branchDepartmentIds.filter((departmentId) => departmentId === hodDepartmentId)
      : timetable.branchDepartmentIds;
    if (!visibleDepartmentIds.length) return null;
    const params = new URLSearchParams({
      academicYear: timetable.academicYear,
      semesterNo: String(timetable.semester),
      departmentIds: visibleDepartmentIds.join(','),
      status: 'Active',
      limit: '100',
    });
    const curriculumId =
      typeof timetable.curriculumId === 'object'
        ? timetable.curriculumId._id
        : timetable.curriculumId;
    if (curriculumId) params.set('curriculumId', curriculumId);
    return `section?${params.toString()}`;
  }, [hodDepartmentId, timetable]);
  const { data: sectionResponse } = useSwr(sectionQuery);
  const lanes = useMemo(() => {
    type SectionRow = {
      _id: string;
      sectionName: string;
      departmentCode: string;
      departmentId: string | { _id: string };
    };
    const selectedSectionId =
      typeof timetable?.sectionId === 'object' ? timetable.sectionId._id : timetable?.sectionId;
    const sections = ((sectionResponse as { data?: SectionRow[] })?.data ?? []).filter(
      (section) => section.sectionName && (!selectedSectionId || section._id === selectedSectionId),
    );
    return (timetable?.branches ?? []).flatMap((code, index) => {
      const departmentId = timetable?.branchDepartmentIds?.[index] ?? '';
      if (hodDepartmentId && departmentId !== hodDepartmentId) return [];
      const matching = sections.filter((section) => {
        const id =
          typeof section.departmentId === 'object'
            ? section.departmentId._id
            : section.departmentId;
        return id === departmentId;
      });
      return matching.length
        ? matching.map((section) => ({
            key: section._id,
            code,
            departmentId,
            label: `${code} (Section ${section.sectionName})`,
          }))
        : [{ key: departmentId || code, code, departmentId, label: code }];
    });
  }, [hodDepartmentId, sectionResponse, timetable]);
  const [hoveredCell, setHoveredCell] = useState<{
    day: TDay;
    minutes: number;
    branchIndex: number;
  } | null>(null);
  const [substitute, setSubstitute] = useState<{
    slot: ITimetableSlot;
    slotIndex: number;
    facultyId: string;
    date: string;
    reason: string;
  } | null>(null);

  const timeRange = useMemo(() => {
    const hasConfiguredRange = Boolean(timetable?.scheduleStartTime && timetable?.scheduleEndTime);
    const starts = hasConfiguredRange
      ? [timeToMinutes(timetable!.scheduleStartTime!)]
      : (timetable?.slots ?? []).map((slot) => timeToMinutes(slot.startTime));
    const ends = hasConfiguredRange
      ? [timeToMinutes(timetable!.scheduleEndTime!)]
      : (timetable?.slots ?? []).map((slot) => timeToMinutes(slot.endTime));
    if (!starts.length) {
      for (const meeting of meetings) {
        const date = new Date(meeting.scheduledAt);
        if (Number.isNaN(date.getTime())) continue;
        const start = date.getHours() * 60 + date.getMinutes();
        starts.push(start);
        ends.push(start + (meeting.durationMinutes ?? 60));
      }
    }
    const startHour = starts.length ? Math.floor(Math.min(...starts) / 60) : 8;
    const endHour = ends.length ? Math.ceil(Math.max(...ends) / 60) : 17;
    const totalHours = Math.max(1, endHour - startHour);
    const gridWidth = Math.max(MIN_GRID_WIDTH, totalHours * MIN_HOUR_WIDTH);
    return { startHour, endHour, gridWidth, hourWidth: gridWidth / totalHours };
  }, [meetings, timetable]);

  // ── Build time labels (12-hour format with AM/PM) ──────────────────────────
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let h = timeRange.startHour; h < timeRange.endHour; h++) {
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      labels.push(`${String(hour12).padStart(2, '0')}:00 ${period}`);
    }
    return labels;
  }, [timeRange]);

  const timeTicks = useMemo(() => {
    const ticks: Array<{ minutes: number; label: string; isHour: boolean }> = [];
    for (let minutes = timeRange.startHour * 60; minutes <= timeRange.endHour * 60; minutes += 10) {
      ticks.push({
        minutes,
        label: formatTime12(`${Math.floor(minutes / 60)}:${minutes % 60}`),
        isHour: minutes % 60 === 0,
      });
    }
    return ticks;
  }, [timeRange]);

  // ── Slot lookup ────────────────────────────────────────────────────────────
  const slotsPerDay = useMemo(() => {
    const map: Partial<Record<TDay, { slot: ITimetableSlot; idx: number }[]>> = {};
    (timetable?.slots ?? []).forEach((slot, idx) => {
      if (hodDepartmentId) {
        const explicitDepartmentIds = slot.branchDepartmentIds?.length
          ? slot.branchDepartmentIds
          : slot.branchDepartmentId
            ? [slot.branchDepartmentId]
            : [];
        const branchDepartmentId = slot.branch
          ? timetable?.branchDepartmentIds?.[(timetable.branches ?? []).indexOf(slot.branch)]
          : undefined;
        const scopedDepartmentIds = explicitDepartmentIds.length
          ? explicitDepartmentIds
          : branchDepartmentId
            ? [branchDepartmentId]
            : [];
        if (scopedDepartmentIds.length && !scopedDepartmentIds.includes(hodDepartmentId)) return;
      }
      if (!map[slot.day]) map[slot.day] = [];
      map[slot.day]!.push({ slot, idx });
    });
    return map;
  }, [hodDepartmentId, timetable]);
  const ownFacultyCount = useMemo(() => {
    if (!hodDepartmentId) return 0;
    return new Set(
      (timetable?.slots ?? [])
        .filter(
          (slot) => slot.facultyId && String(slot.facultyDepartmentId ?? '') === hodDepartmentId,
        )
        .map((slot) => String(slot.facultyId)),
    ).size;
  }, [hodDepartmentId, timetable]);

  // ── Meeting events for this week (keyed by TDay) ───────────────────────────
  const meetingsByDay = useMemo(() => {
    const map: Partial<Record<TDay, IMeetingEvent[]>> = {};
    meetings.forEach((m) => {
      const d = new Date(m.scheduledAt);
      const dow = d.getDay();
      const day = JS_DOW_TO_DAY[dow];
      if (!day) return;
      if (!map[day]) map[day] = [];
      map[day]!.push(m);
    });
    return map;
  }, [meetings]);

  // ── Conflict detection ─────────────────────────────────────────────────────
  const hasConflict = (s: ITimetableSlot, slotIndex: number): boolean => {
    if (!timetable) return false;
    const sStart = timeToMinutes(s.startTime);
    const sEnd = timeToMinutes(s.endTime);
    return (timetable.slots ?? []).some((other, otherIndex) => {
      if (otherIndex === slotIndex) return false;
      if (other.day !== s.day) return false;
      // skip same exact slot (edit case)
      const oStart = timeToMinutes(other.startTime);
      const oEnd = timeToMinutes(other.endTime);
      const overlaps = sStart < oEnd && sEnd > oStart;
      if (!overlaps) return false;
      if (other.facultyId && s.facultyId && other.facultyId === s.facultyId) return true;
      if (other.roomNo && s.roomNo && other.roomNo === s.roomNo) return true;
      return false;
    });
  };

  // ── Substitute assign ──────────────────────────────────────────────────────
  const handleSubstitute = async (slot: ITimetableSlot, slotIndex: number) => {
    if (!timetable) return;
    setSubstitute({
      slot,
      slotIndex,
      facultyId: '',
      date: '',
      reason: '',
    });
  };

  const assignSubstitute = async () => {
    if (!timetable || !substitute?.facultyId || !substitute.date) return;
    const res = await mutation(`timetable/${timetable._id}/substitute`, {
      method: 'POST',
      body: {
        slotIndex: substitute.slotIndex,
        substituteFacultyId: substitute.facultyId,
        date: substitute.date,
        reason: substitute.reason,
      },
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Substitute faculty assigned');
      setSubstitute(null);
      onMutate((res as { results?: { data?: ITimetable } })?.results?.data);
    }
  };

  // ── Click on empty area to add ─────────────────────────────────────────────
  const minutesFromPointerX = (element: HTMLDivElement, clientX: number, day: TDay) => {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, timeRange.gridWidth - 1));
    const rawMinutes = (x / timeRange.hourWidth) * 60 + timeRange.startHour * 60;
    const timetableBoundaries = (timetable?.slots ?? [])
      .filter((slot) => slot.day === day)
      .flatMap((slot) => [timeToMinutes(slot.startTime), timeToMinutes(slot.endTime)]);
    if (timetable?.scheduleStartTime) {
      timetableBoundaries.push(timeToMinutes(timetable.scheduleStartTime));
    }
    if (timetable?.scheduleEndTime) {
      timetableBoundaries.push(timeToMinutes(timetable.scheduleEndTime));
    }
    const closestBoundary = timetableBoundaries.reduce<number | null>((closest, boundary) => {
      if (Math.abs(boundary - rawMinutes) > 8) return closest;
      if (closest === null) return boundary;
      return Math.abs(boundary - rawMinutes) < Math.abs(closest - rawMinutes) ? boundary : closest;
    }, null);
    return closestBoundary ?? Math.round(rawMinutes / 10) * 10;
  };

  const formatMinutes = (minutes: number) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  };

  const handleCellClick = (
    day: TDay,
    rowLanes: TimetableLane[],
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!onAddSlot) return;
    const minutes = minutesFromPointerX(e.currentTarget, e.clientX, day);
    const rect = e.currentTarget.getBoundingClientRect();
    const branchIndex = Math.min(
      rowLanes.length - 1,
      Math.max(
        0,
        Math.floor(
          ((e.clientY - rect.top) / Math.max(1, rect.height - DAY_GROUP_BORDER)) * rowLanes.length,
        ),
      ),
    );
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const lane = rowLanes[branchIndex];
    onAddSlot(day, time24, lane?.departmentId, lane?.code);
  };

  if (!timetable) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-slate-200/80 bg-white  text-slate-300">
        <svg
          className="mb-4 h-16 w-16 text-slate-300"
          fill="none"
          viewBox="0 0 64 64"
          stroke="currentColor"
          strokeWidth={1.2}
        >
          <rect x="8" y="8" width="48" height="48" rx="8" />
          <line x1="8" y1="20" x2="56" y2="20" />
          <line x1="8" y1="32" x2="56" y2="32" />
          <line x1="8" y1="44" x2="56" y2="44" />
          <line x1="22" y1="8" x2="22" y2="56" />
          <line x1="36" y1="8" x2="36" y2="56" />
        </svg>
        <p className="text-base font-semibold text-slate-600">Select a timetable to view grid</p>
        <p className="mt-1 text-xs text-slate-600">
          Choose a timetable from the dropdown above or add slots
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white ">
      {substitute && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close substitute dialog"
            className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
            onClick={() => setSubstitute(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6  border border-slate-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Assign substitute faculty</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {substitute.slot.subjectName} · {substitute.slot.day}{' '}
              {formatTime12(substitute.slot.startTime)}–{formatTime12(substitute.slot.endTime)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Current faculty:{' '}
              <span className="font-semibold text-slate-700">{substitute.slot.facultyName}</span>
            </p>
            <div className="mt-5 space-y-4">
              <AsyncSelect
                label="Substitute Faculty"
                type="faculty"
                value={substitute.facultyId || null}
                onChange={(facultyId) =>
                  setSubstitute((current) =>
                    current ? { ...current, facultyId: facultyId ?? '' } : current,
                  )
                }
                required
                placeholder="Search faculty name or employee code…"
              />
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={substitute.date}
                  onChange={(event) =>
                    setSubstitute((current) =>
                      current ? { ...current, date: event.target.value } : current,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  value={substitute.reason}
                  onChange={(event) =>
                    setSubstitute((current) =>
                      current ? { ...current, reason: event.target.value } : current,
                    )
                  }
                  placeholder="Leave, duty assignment, or another reason"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <CustomButton variant="cancel" type="button" onClick={() => setSubstitute(null)}>
                Cancel
              </CustomButton>
              <CustomButton
                type="button"
                disabled={
                  !substitute.facultyId || !substitute.date || substitute.reason.trim().length < 3
                }
                onClick={assignSubstitute}
              >
                Assign Substitute
              </CustomButton>
            </div>
          </div>
        </div>
      )}

      {/* Header info bar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
        <span className="font-bold text-slate-900 text-base">{timetable.program}</span>
        <span className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 ">
          Sem {timetable.semester}
          {timetable.section ? ` · ${timetable.section}` : ' · Whole cohort'}
        </span>
        <span className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 ">
          {timetable.academicYear}
        </span>
        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-bold capitalize ${timetable.semesterType === 'odd' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}
        >
          {timetable.semesterType} Semester
        </span>
        {timetable.isApproved && (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
            ✓ Published &amp; Approved
          </span>
        )}
        {hodDepartmentId && (
          <MuiTooltip title="Unique faculty from your department assigned in this timetable" arrow>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-secondary/40 bg-secondary-50 px-2.5 py-1 text-xs font-bold text-secondary">
              <UserCheck className="h-3.5 w-3.5" /> {ownFacultyCount} department faculty assigned
            </span>
          </MuiTooltip>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-2">
          {Object.entries(CLASS_TYPE_STYLE).map(([type, s]) => (
            <span
              key={type}
              className={`rounded-md border px-2.5 py-1 text-xs font-bold capitalize  ${s.bg} ${s.border} ${s.text}`}
            >
              {type}
            </span>
          ))}
          <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary ">
            meeting
          </span>
        </div>
      </div>

      {/* Calendar grid (Left = Day & Branch, Top = Time) */}
      <div className="flex overflow-hidden select-none">
        {/* Left Day & Branch axis column */}
        <div className="z-20 w-52 shrink-0 border-r border-slate-300 bg-slate-50/60">
          {/* Top left corner header spacer */}
          <div className="grid h-14 grid-cols-[4rem_1fr] border-b border-slate-300 bg-slate-100/90">
            <span className="flex items-center px-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Day
            </span>
            <span className="flex items-center border-l border-slate-200 px-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Branch
            </span>
          </div>
          {/* Day & Branch labels (Sub-Rows) */}
          <div>
            {DAYS.map((day) => {
              const daySlots = slotsPerDay[day] ?? [];
              const deptCode =
                typeof timetable.departmentId === 'object' ? timetable.departmentId.code : '';
              const rowLanes = lanes.length
                ? lanes
                : [
                    {
                      key: deptCode || timetable.program,
                      code: deptCode || timetable.program || 'Main',
                      departmentId: '',
                      label: deptCode || timetable.program || 'Main',
                    },
                  ];
              const { height, laneHeight } = dayGroupMetrics(rowLanes.length);
              return (
                <div
                  key={day}
                  className="grid grid-cols-[4rem_1fr] border-b border-slate-400 last:border-b-0"
                  style={{ height }}
                >
                  <div className="flex flex-col items-center justify-center bg-slate-100 px-1 text-center">
                    <span className="text-xs font-extrabold text-slate-800 tracking-wide uppercase">
                      {DAY_SHORT[day]}
                    </span>
                    <span className="mt-1 text-[9px] font-semibold leading-none text-slate-500">
                      {daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'}
                    </span>
                  </div>
                  <div
                    className="relative grid border-l border-slate-300"
                    style={{ gridTemplateRows: `repeat(${rowLanes.length}, ${laneHeight}px)` }}
                  >
                    {rowLanes.map((lane) => (
                      <div
                        key={lane.key}
                        className="flex min-w-0 items-center bg-slate-50/50 px-2 hover:bg-slate-100/50"
                      >
                        <span className="truncate text-[10px] font-extrabold text-slate-700">
                          {lane.label}
                        </span>
                      </div>
                    ))}
                    {rowLanes.slice(1).map((lane, branchIndex) => (
                      <div
                        key={`left-lane-${lane.key}`}
                        className="pointer-events-none absolute inset-x-0 border-t border-slate-200"
                        style={{ top: (branchIndex + 1) * laneHeight }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Time Columns & Day Row Content */}
        <div className="flex flex-1 flex-col overflow-x-auto">
          {/* Top Time Header Row */}
          <div
            className="relative flex h-14 border-b border-slate-300 bg-slate-100/80"
            style={{ width: timeRange.gridWidth }}
          >
            {timeTicks.map((tick, index) => {
              const left = minutesToPxX(tick.minutes, timeRange.startHour, timeRange.hourWidth);
              return (
                <React.Fragment key={tick.minutes}>
                  <span
                    className={`absolute z-10 font-mono leading-none text-nowrap tabular-nums ${index === 0 ? '' : index === timeTicks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'} ${tick.isHour ? 'top-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary ' : 'bottom-1 text-[10px] font-bold text-secondary/70'}`}
                    style={{ left }}
                  >
                    {tick.label}
                  </span>
                </React.Fragment>
              );
            })}
          </div>

          {/* Day Rows Container */}
          <div className="flex flex-col" style={{ width: timeRange.gridWidth }}>
            {DAYS.map((day) => {
              const daySlots = slotsPerDay[day] ?? [];
              const dayMeetings = meetingsByDay[day] ?? [];
              const deptCode =
                typeof timetable.departmentId === 'object' ? timetable.departmentId.code : '';
              const rowLanes = lanes.length
                ? lanes
                : [
                    {
                      key: deptCode || timetable.program,
                      code: deptCode || timetable.program || 'Main',
                      departmentId: '',
                      label: deptCode || timetable.program || 'Main',
                    },
                  ];
              const branches = rowLanes.map((lane) => lane.code);
              const { height, laneHeight } = dayGroupMetrics(rowLanes.length);

              return (
                <div
                  key={day}
                  className="relative cursor-pointer border-b border-slate-400 bg-white hover:bg-slate-50/20 last:border-b-0"
                  style={{ height }}
                  onClick={(e) => handleCellClick(day, rowLanes, e)}
                  onMouseMove={(e) => {
                    if ((e.target as HTMLElement).closest('[data-timetable-slot="true"]')) {
                      setHoveredCell(null);
                      return;
                    }
                    setHoveredCell({
                      day,
                      minutes: minutesFromPointerX(e.currentTarget, e.clientX, day),
                      branchIndex: Math.min(
                        rowLanes.length - 1,
                        Math.max(
                          0,
                          Math.floor(
                            ((e.clientY - e.currentTarget.getBoundingClientRect().top) /
                              Math.max(
                                1,
                                e.currentTarget.getBoundingClientRect().height - DAY_GROUP_BORDER,
                              )) *
                              rowLanes.length,
                          ),
                        ),
                      ),
                    });
                  }}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  {/* Hour vertical grid lines */}
                  {timeLabels.map((_, i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute top-0 bottom-0 border-r border-slate-200/80"
                      style={{ left: (i + 1) * timeRange.hourWidth }}
                    />
                  ))}
                  {timeTicks
                    .filter((tick) => !tick.isHour)
                    .map((tick) => (
                      <div
                        key={`minor-${tick.minutes}`}
                        className="pointer-events-none absolute top-0 bottom-0 border-r border-dashed border-slate-200/55"
                        style={{
                          left: minutesToPxX(
                            tick.minutes,
                            timeRange.startHour,
                            timeRange.hourWidth,
                          ),
                        }}
                      />
                    ))}
                  {rowLanes.slice(1).map((lane, branchIndex) => (
                    <div
                      key={`lane-${lane.key}`}
                      className="pointer-events-none absolute inset-x-0 border-t border-slate-200"
                      style={{ top: (branchIndex + 1) * laneHeight }}
                    />
                  ))}
                  {/* Hover indicator for adding slot */}
                  {hoveredCell?.day === day &&
                    onAddSlot &&
                    !daySlots.some(
                      ({ slot }) =>
                        (slot.isCombined
                          ? !slot.branches?.length ||
                            slot.branches.includes(branches[hoveredCell.branchIndex]!)
                          : !slot.branch || slot.branch === branches[hoveredCell.branchIndex]) &&
                        hoveredCell.minutes < timeToMinutes(slot.endTime) &&
                        hoveredCell.minutes + 50 > timeToMinutes(slot.startTime),
                    ) && (
                      <div
                        className="pointer-events-none absolute z-30 flex items-center justify-center gap-1 rounded-md border border-dashed border-primary/60 bg-primary/10 px-1 whitespace-nowrap  transition-all"
                        style={{
                          left:
                            minutesToPxX(
                              hoveredCell.minutes,
                              timeRange.startHour,
                              timeRange.hourWidth,
                            ) + 3,
                          top: hoveredCell.branchIndex * laneHeight + 3,
                          width: Math.max(48, (timeRange.hourWidth * 50) / 60 - 6),
                          height: Math.max(24, laneHeight - 6),
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-[10.5px] font-extrabold text-primary tracking-tight">
                          {formatMinutes(hoveredCell.minutes)}
                        </span>
                      </div>
                    )}

                  {/* Meetings overlay */}
                  {dayMeetings.map((m) => {
                    const d = new Date(m.scheduledAt);
                    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    const endMin = timeToMinutes(timeStr) + (m.durationMinutes ?? 60);
                    const endH = Math.floor(endMin / 60);
                    const endM = endMin % 60;
                    const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                    const left = slotLeft(timeStr, timeRange.startHour, timeRange.hourWidth);
                    const width = slotWidth(timeStr, endStr, timeRange.hourWidth);
                    if (left < 0 || left > timeRange.gridWidth) return null;
                    return (
                      <div
                        key={m._id}
                        className="absolute z-10 flex flex-col justify-center overflow-hidden rounded-lg border border-primary/40 bg-primary/10 p-2 "
                        style={{
                          top: CARD_GUTTER,
                          bottom: CARD_GUTTER,
                          left: Math.max(CARD_GUTTER, left + CARD_GUTTER),
                          width: Math.max(40, width - CARD_GUTTER * 2),
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title={m.title}
                      >
                        <p className="truncate text-[11px] font-bold text-primary leading-tight">
                          {m.title}
                        </p>
                        <p className="text-[10px] font-semibold text-primary/70">
                          {formatTime12(timeStr)}
                        </p>
                      </div>
                    );
                  })}

                  {/* Timetable slot cards */}
                  {daySlots.map(({ slot, idx }) => {
                    const left = slotLeft(slot.startTime, timeRange.startHour, timeRange.hourWidth);
                    const width = slotWidth(slot.startTime, slot.endTime, timeRange.hourWidth);
                    const slotKind = slot.slotKind ?? 'teaching';
                    const style =
                      CLASS_TYPE_STYLE[slotKind === 'teaching' ? slot.classType : slotKind] ??
                      CLASS_TYPE_STYLE.theory;
                    const conflict = hasConflict(slot, idx);
                    const storedCombinedBranchIds = slot.branchDepartmentIds ?? [];
                    const slotBranchCodes = slot.branches?.length
                      ? slot.branches
                      : storedCombinedBranchIds
                          .map((departmentId) => {
                            const timetableIndex = (timetable.branchDepartmentIds ?? []).indexOf(
                              departmentId,
                            );
                            return timetableIndex >= 0
                              ? timetable.branches?.[timetableIndex]
                              : undefined;
                          })
                          .filter((branch): branch is string => Boolean(branch));
                    const isCombined = Boolean(
                      slot.isCombined ||
                      storedCombinedBranchIds.length > 1 ||
                      slotBranchCodes.length > 1,
                    );
                    const isOwnFaculty = Boolean(
                      hodDepartmentId && String(slot.facultyDepartmentId ?? '') === hodDepartmentId,
                    );
                    const branchIndexes = slot.branch
                      ? branches.flatMap((branch, index) => (branch === slot.branch ? [index] : []))
                      : [];
                    const branchIndex = branchIndexes[0] ?? -1;
                    const branchEndIndex = branchIndexes.at(-1) ?? branchIndex;
                    const combinedBranchIndexes = branches.flatMap((branch, index) =>
                      slotBranchCodes.includes(branch) ? [index] : [],
                    );
                    const combinedStartIndex = combinedBranchIndexes.length
                      ? Math.min(...combinedBranchIndexes)
                      : 0;
                    const combinedEndIndex = combinedBranchIndexes.length
                      ? Math.max(...combinedBranchIndexes)
                      : branches.length - 1;
                    const laneTop = isCombined
                      ? combinedStartIndex * laneHeight + CARD_GUTTER
                      : branchIndex >= 0
                        ? branchIndex * laneHeight + CARD_GUTTER
                        : CARD_GUTTER;
                    const laneCardHeight = isCombined
                      ? (combinedEndIndex - combinedStartIndex + 1) * laneHeight - CARD_GUTTER * 2
                      : branchIndex >= 0
                        ? (branchEndIndex - branchIndex + 1) * laneHeight - CARD_GUTTER * 2
                        : height - DAY_GROUP_BORDER - CARD_GUTTER * 2;

                    return (
                      <motion.div
                        key={idx}
                        data-timetable-slot="true"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`group absolute z-20 flex cursor-pointer flex-col justify-between gap-1 overflow-hidden rounded-lg border p-2  transition-all duration-150 hover:-translate-y-px  ${
                          isCombined
                            ? 'border-secondary bg-secondary-50 text-slate-900 hover:brightness-[0.98]'
                            : conflict
                              ? 'border-red-400 bg-red-50 text-red-950'
                              : `${style.bg} ${style.border}`
                        }`}
                        style={{
                          left: Math.max(CARD_GUTTER, left + CARD_GUTTER),
                          width: Math.max(50, width - CARD_GUTTER * 2),
                          top: laneTop,
                          height: laneCardHeight,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSlot?.(slot, idx);
                        }}
                        onMouseMove={(e) => {
                          e.stopPropagation();
                          setHoveredCell(null);
                        }}
                        title={`${slot.subjectName} · ${slot.facultyName}${isCombined ? ' (Combined All Branches)' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p
                            className={`truncate text-[11px] font-extrabold leading-tight ${
                              isCombined ? 'text-secondary' : conflict ? 'text-red-900' : style.text
                            }`}
                          >
                            {slotKind === 'teaching'
                              ? isCombined && slot.subjectCode
                                ? slot.subjectCode
                                : [slot.subjectCode, slot.subjectName].filter(Boolean).join(' · ')
                              : (slot.title ?? slot.subjectName)}
                          </p>
                          {isCombined ? (
                            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-white">
                              COMBINED
                            </span>
                          ) : conflict ? (
                            <span className="text-[10px] font-bold text-red-700 shrink-0">
                              ⚠ Conflict
                            </span>
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          {slotKind === 'teaching' && (
                            <>
                              {isCombined && slot.subjectCode && (
                                <p className="line-clamp-2 text-[10px] font-semibold leading-snug text-slate-700">
                                  {slot.subjectName}
                                </p>
                              )}
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="min-w-0 truncate text-[10px] font-medium text-slate-600">
                                  {slot.facultyName || 'Faculty not assigned'}
                                  {slot.roomNo ? ` · ${slot.roomNo}` : ''}
                                </p>
                                {isOwnFaculty && (
                                  <MuiTooltip title="Faculty belongs to your department" arrow>
                                    <span
                                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-secondary/40 bg-secondary-50 text-secondary"
                                      aria-label="Own department faculty"
                                    >
                                      <UserCheck className="h-2.5 w-2.5" />
                                    </span>
                                  </MuiTooltip>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        <p className="shrink-0 truncate border-t border-slate-300/50 pt-1 font-mono text-[9px] font-semibold leading-none text-slate-500 tabular-nums">
                          {formatTime12(slot.startTime)}–{formatTime12(slot.endTime)}
                        </p>

                        {/* Substitute action is only available on approved schedules. */}
                        {canAssignSubstitute && (
                          <MuiTooltip
                            title="Assign a substitute teacher for this class"
                            placement="top"
                            arrow
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubstitute(slot, idx);
                              }}
                              className="absolute right-2 top-2 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary/30 bg-primary-50 text-primary opacity-0  transition-all duration-150 hover:scale-105 hover:border-primary hover:bg-primary hover:text-white hover:opacity-100  focus-visible:bg-primary focus-visible:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 group-hover:opacity-100"
                              aria-label={`Assign substitute teacher for ${slot.subjectName}`}
                            >
                              <UserCheck className="h-5 w-5" strokeWidth={2.25} />
                            </button>
                          </MuiTooltip>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

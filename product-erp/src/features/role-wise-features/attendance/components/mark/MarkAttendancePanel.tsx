/**
 * @file MarkAttendancePanel.tsx
 * @description Two-step attendance marking flow: picking today's scheduled class and marking students.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Popover from '@mui/material/Popover';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';
import { toast } from 'react-toastify';
import {
  CalendarCheck2,
  CheckCircle,
  CircleDot,
  Clock,
  MapPin,
  Plus,
  TimerReset,
  User,
  Users,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import { useHasRole, useHasAnyRole } from '@/shared/hooks/useHasRole';
import { TSystemRole } from '@/shared/types';
import { mutate as mutateCache } from 'swr';
import type {
  AttendanceStatus,
  ClassType,
  IAllotmentLite,
  IAttendanceRecord,
  ISelectedClass,
  IStudentLite,
  ITimetableApi,
} from '../../types/attendance.types';
import { DAY_NAMES, getMonthTheme } from '../../utils/attendance.constants';
import { currentAcademicYear, extractId, localDateKey, normalizeDateKey } from '../../utils/attendance.helpers';
import AttendanceCardsSkeleton from '../common/AttendanceCardsSkeleton';
import RosterMarker from './RosterMarker';
import ManualClassPicker from './ManualClassPicker';

export function MarkAttendancePanel() {
  const userId = useAuthStore((s) => s.user?._id);
  const { mutation, isLoading } = useMutation();
  const isHod = useHasRole('hod');
  const isLeadership = useHasAnyRole(['hod', 'super_admin', 'principal', 'dean_academic'] as TSystemRole[]);
  const canUseManualClass = isHod;
  const [markScope, setMarkScope] = useState<'my' | 'department'>('my');

  const [selectedClass, setSelectedClass] = useState<ISelectedClass | null>(null);
  const [date, setDate] = useState(localDateKey(new Date()));
  const [rangeStart, setRangeStart] = useState(() =>
    localDateKey(startOfWeek(new Date(), { weekStartsOn: 1 })),
  );
  const [rangeEnd, setRangeEnd] = useState(() =>
    localDateKey(endOfWeek(new Date(), { weekStartsOn: 1 })),
  );
  const [rangeAnchor, setRangeAnchor] = useState<HTMLElement | null>(null);
  const [draftRange, setDraftRange] = useState<[Date | null, Date | null]>(() => [
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    endOfWeek(new Date(), { weekStartsOn: 1 }),
  ]);
  const [leftCalendarMonth, setLeftCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [manualMode, setManualMode] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => new Date());

  const rangeValue: [Date | null, Date | null] = [
    new Date(`${rangeStart}T00:00:00`),
    new Date(`${rangeEnd}T00:00:00`),
  ];
  const applyRange = (start: Date, end: Date) => {
    const orderedStart = start <= end ? start : end;
    const orderedEnd = start <= end ? end : start;
    const days = Math.round((orderedEnd.getTime() - orderedStart.getTime()) / 86_400_000) + 1;
    if (days > 31) {
      toast.info('Choose a date range of up to 31 days');
      return;
    }
    setRangeStart(localDateKey(orderedStart));
    setRangeEnd(localDateKey(orderedEnd));
    setDraftRange([orderedStart, orderedEnd]);
  };
  const selectRangeDay = (selectedDay: Date) => {
    if (!draftRange[0] || draftRange[1]) {
      setDraftRange([selectedDay, null]);
      return;
    }
    applyRange(draftRange[0], selectedDay);
  };
  const rangeDayProps = (day: Date) => {
    const start = draftRange[0];
    const end = draftRange[1];
    const dayKey = localDateKey(day);
    const startKey = start ? localDateKey(start) : null;
    const endKey = end ? localDateKey(end) : null;
    const isStart = dayKey === startKey;
    const isEnd = dayKey === endKey;
    const isBoundary = isStart || isEnd;
    const inRange = Boolean(startKey && endKey && dayKey >= startKey && dayKey <= endKey);
    const isSingleDay = Boolean(startKey && endKey && startKey === endKey);
    return {
      selected: isBoundary,
      sx: {
        borderRadius: isSingleDay
          ? '50%'
          : isStart
            ? '50% 0 0 50%'
            : isEnd
              ? '0 50% 50% 0'
              : inRange
                ? 0
                : '50%',
        backgroundColor: inRange ? '#0878da !important' : undefined,
        color: inRange ? '#fff !important' : undefined,
        fontWeight: inRange ? 700 : undefined,
        '&:hover': {
          backgroundColor: inRange ? '#0668bd !important' : undefined,
        },
        '&.Mui-selected': {
          backgroundColor: '#0878da !important',
          color: '#fff !important',
        },
        '&.Mui-focusVisible': {
          outline: '2px solid #fff',
          outlineOffset: '-3px',
        },
      },
    };
  };
  const resetRange = () =>
    applyRange(subDays(new Date(), 1), subDays(addMonths(new Date(), 0), -2));
  const rangePresets = [
    {
      label: 'This Week',
      getValue: () =>
        [
          startOfWeek(new Date(), { weekStartsOn: 1 }),
          endOfWeek(new Date(), { weekStartsOn: 1 }),
        ] as const,
    },
    {
      label: 'Last Week',
      getValue: () => {
        const lastWeek = subWeeks(new Date(), 1);
        return [
          startOfWeek(lastWeek, { weekStartsOn: 1 }),
          endOfWeek(lastWeek, { weekStartsOn: 1 }),
        ] as const;
      },
    },
    { label: 'Last 7 Days', getValue: () => [subDays(new Date(), 6), new Date()] as const },
    {
      label: 'Current Month',
      getValue: () => [startOfMonth(new Date()), endOfMonth(new Date())] as const,
    },
    {
      label: 'Next Month',
      getValue: () => {
        const nextMonth = addMonths(new Date(), 1);
        return [startOfMonth(nextMonth), endOfMonth(nextMonth)] as const;
      },
    },
  ];

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedDate = new Date(`${rangeStart}T00:00:00`);
  const ay = currentAcademicYear(selectedDate);
  // jul–dec = odd, jan–jun = even
  const semType: 'odd' | 'even' = selectedDate.getMonth() >= 6 ? 'odd' : 'even';

  const timetableUrl =
    isHod && markScope === 'department'
      ? `timetable?academicYear=${ay}&semesterType=${semType}&isActive=true`
      : userId
        ? `timetable/faculty?facultyId=${userId}&academicYear=${ay}&semesterType=${semType}`
        : null;

  const { data: ttRaw, isLoading: ttLoading } = useSwr(timetableUrl);
  const timetables: ITimetableApi[] = Array.isArray(ttRaw)
    ? ttRaw
    : ((ttRaw as { data?: ITimetableApi[] })?.data ?? []);

  const attendanceUrl =
    isHod && markScope === 'department'
      ? `attendance?from=${rangeStart}&to=${rangeEnd}`
      : `attendance?from=${rangeStart}&to=${rangeEnd}&scope=my`;
  const { data: attendanceRaw, mutate: refetchAttendance } = useSwr(attendanceUrl);
  const recordedAttendance: IAttendanceRecord[] = Array.isArray(attendanceRaw)
    ? attendanceRaw
    : ((attendanceRaw as { data?: IAttendanceRecord[] })?.data ?? []);

  const attendanceForClass = (classItem: ISelectedClass) =>
    recordedAttendance.find((record) => {
      const recDate = normalizeDateKey(record.date);
      const targetDate = normalizeDateKey(classItem.scheduledDate);
      const sameDate = !targetDate || recDate === targetDate;
      if (!sameDate) return false;

      const recSlotId = extractId(record.timetableSlotId);
      const targetSlotId = extractId(classItem.timetableSlotId);
      if (recSlotId && targetSlotId && recSlotId === targetSlotId) {
        return true;
      }

      const recSubId = extractId(record.subjectId);
      const targetSubId = extractId(classItem.subjectId);
      const matchSubject =
        (recSubId && targetSubId && recSubId === targetSubId) ||
        (record.subjectCode && classItem.subjectCode && record.subjectCode === classItem.subjectCode);

      const matchPeriod = record.periodNumber === classItem.periodNumber;
      if (matchSubject && matchPeriod) {
        const recTtId = extractId(record.timetableId);
        const targetTtId = extractId(classItem.timetableId);
        if (recTtId && targetTtId && recTtId === targetTtId) {
          return true;
        }

        const recSecId = extractId(record.sectionId);
        const targetSecId = extractId(classItem.sectionId);
        if (recSecId && targetSecId && recSecId === targetSecId) {
          return true;
        }

        if (classItem.section && record.section) {
          return classItem.section.toLowerCase() === record.section.toLowerCase();
        }
        return true;
      }
      return false;
    });

  const rangeStartDate = new Date(`${rangeStart}T00:00:00`);
  const rangeEndDate = new Date(`${rangeEnd}T00:00:00`);
  const rangeDayCount = Math.max(
    1,
    Math.min(31, Math.floor((rangeEndDate.getTime() - rangeStartDate.getTime()) / 86_400_000) + 1),
  );
  const rangeDates = Array.from({ length: rangeDayCount }, (_, index) => {
    const rangeDate = new Date(rangeStartDate);
    rangeDate.setDate(rangeDate.getDate() + index);
    return rangeDate;
  });
  const todayClasses: (ISelectedClass & {
    roomNo: string;
    facultyId?: string;
    facultyName?: string;
  })[] = [];
  for (const scheduledDate of rangeDates) {
    const selectedDay = DAY_NAMES[scheduledDate.getDay()];
    for (const t of timetables) {
      for (const s of t.slots ?? []) {
        if ((s.day ?? '').toLowerCase() !== selectedDay) continue;
        if (s.slotKind === 'break' || (!s.subjectId && !s.subjectCode)) continue;
        if (markScope === 'my' && String(s.facultyId ?? '') !== String(userId ?? '')) continue;
        if (markScope === 'department' && String(s.facultyId ?? '') === String(userId ?? '')) continue;
        const ct: ClassType =
          s.classType === 'lab' ? 'Practical' : s.classType === 'tutorial' ? 'Tutorial' : 'Lecture';
        todayClasses.push({
          scheduledDate: localDateKey(scheduledDate),
          sectionId:
            typeof t.sectionId === 'object' ? t.sectionId._id : (t.sectionId as string | undefined),
          timetableId: t._id,
          timetableSlotId: s._id,
          subjectId: s.subjectId,
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          facultyId: s.facultyId ? String(s.facultyId) : undefined,
          facultyName: s.facultyName,
          departmentId:
            s.branchDepartmentId ??
            (typeof t.departmentId === 'object' ? t.departmentId._id : t.departmentId),
          program: t.program,
          branch: s.branch || (s.branches && s.branches.length ? s.branches.join(', ') : t.program),
          semester: t.semester,
          section: t.section || '',
          academicYear: t.academicYear,
          startTime: s.startTime,
          endTime: s.endTime,
          periodNumber: s.periodNo,
          classType: ct,
          roomNo: [s.roomName || s.roomNo, s.roomBuilding, s.roomFloor && `Floor ${s.roomFloor}`]
            .filter(Boolean)
            .join(' · '),
        });
      }
    }
  }
  todayClasses.sort((a, b) =>
    `${a.scheduledDate}-${a.startTime}`.localeCompare(`${b.scheduledDate}-${b.startTime}`),
  );

  const todayKey = localDateKey(now);
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const toMinute = (time: string) => {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const classState = (classItem: ISelectedClass) => {
    if (attendanceForClass(classItem)) return 'recorded' as const;
    const selectedDateKey = classItem.scheduledDate ?? date;
    if (selectedDateKey < todayKey) {
      const classEnd = new Date(`${selectedDateKey}T${classItem.endTime}:00`);
      return now.getTime() - classEnd.getTime() > 24 * 60 * 60 * 1000
        ? ('missed' as const)
        : ('due' as const);
    }
    if (selectedDateKey > todayKey) return 'upcoming' as const;
    if (currentMinute < toMinute(classItem.startTime)) return 'upcoming' as const;
    if (currentMinute <= toMinute(classItem.endTime)) return 'live' as const;
    return 'due' as const;
  };
  const submissionDeadline = (classItem: ISelectedClass) => {
    const selectedDateKey = classItem.scheduledDate ?? date;
    const classEnd = new Date(`${selectedDateKey}T${classItem.endTime}:00`);
    return new Date(classEnd.getTime() + 24 * 60 * 60 * 1000);
  };
  const formatSubmissionDeadline = (classItem: ISelectedClass) =>
    submissionDeadline(classItem).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const canEditRecordedClass = (classItem: ISelectedClass) => {
    const attendance = attendanceForClass(classItem);
    if (!attendance) return false;
    if (isLeadership) return true;
    return Boolean(!attendance.isLocked && now <= submissionDeadline(classItem));
  };
  const recordedCount = todayClasses.filter((classItem) => attendanceForClass(classItem)).length;
  const missedCount = todayClasses.filter((classItem) => classState(classItem) === 'missed').length;
  const liveCount = todayClasses.filter((classItem) => classState(classItem) === 'live').length;
  const upcomingCount = todayClasses.filter(
    (classItem) => classState(classItem) === 'upcoming',
  ).length;
  const dueCount = todayClasses.filter((classItem) => classState(classItem) === 'due').length;
  const attendanceTotals = recordedAttendance.reduce(
    (totals, record) => ({
      present: totals.present + Number(record.totalPresent ?? 0),
      absent: totals.absent + record.entries.filter((entry) => entry.status === 'A').length,
      late: totals.late + record.entries.filter((entry) => entry.status === 'L').length,
      other:
        totals.other +
        record.entries.filter((entry) => ['M', 'OD', 'H'].includes(entry.status)).length,
      strength: totals.strength + Number(record.totalStrength ?? 0),
    }),
    { present: 0, absent: 0, late: 0, other: 0, strength: 0 },
  );
  const recordingRate = todayClasses.length
    ? Math.round((recordedCount / todayClasses.length) * 100)
    : 0;
  const presenceRate = attendanceTotals.strength
    ? Math.round((attendanceTotals.present / attendanceTotals.strength) * 100)
    : 0;

  const {
    data: stRaw,
    isLoading: stLoading,
    mutate: refetchStudents,
  } = useSwr(
    selectedClass?.sectionId
      ? `student-section-allotment?sectionId=${selectedClass.sectionId}&status=Active&limit=500`
      : selectedClass
        ? `student-profile?program=${encodeURIComponent(selectedClass.program)}&semester=${selectedClass.semester}&limit=500`
        : null,
  );
  const rawStudents: IStudentLite[] = Array.isArray(stRaw)
    ? stRaw
    : ((stRaw as { data?: IStudentLite[] })?.data ?? []);
  const rawAllotments: IAllotmentLite[] = Array.isArray(stRaw)
    ? stRaw
    : ((stRaw as { data?: IAllotmentLite[] })?.data ?? []);
  const students: IStudentLite[] = selectedClass?.sectionId
    ? rawAllotments.map((a) => {
      const user = typeof a.studentId === 'object' ? a.studentId : { _id: a.studentId };
      const profile: {
        _id?: string;
        rollNumber?: string;
        firstName?: string;
        lastName?: string;
      } =
        typeof a.studentProfileId === 'object' && a.studentProfileId !== null
          ? a.studentProfileId
          : {};
      return {
        _id: String(user?._id || a.studentId),
        rollNumber: String(a.rollNo || profile.rollNumber || ''),
        name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || user?.name || 'Student',
      };
    })
    : rawStudents.map((s) => ({
      _id: String(s._id),
      rollNumber: String(s.rollNumber || ''),
      name:
        s.name ||
        [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ') ||
        'Student',
    }));

  // Load saved values for an editable record; otherwise default a new roster to Present.
  React.useEffect(() => {
    if (selectedClass && students.length) {
      const existingAttendance = attendanceForClass(selectedClass);
      const savedEntries = new Map(
        (existingAttendance?.entries ?? []).map((entry) => [String(entry.studentId), entry]),
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusMap(() => {
        const next: Record<string, AttendanceStatus> = {};
        students.forEach((s) => {
          next[s._id] = savedEntries.get(String(s._id))?.status ?? 'P';
        });
        return next;
      });
      setRemarksMap(() => {
        const next: Record<string, string> = {};
        students.forEach((student) => {
          const remarks = savedEntries.get(String(student._id))?.remarks;
          if (remarks) next[student._id] = remarks;
        });
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedClass?.subjectId,
    selectedClass?.periodNumber,
    selectedClass?.scheduledDate,
    students.length,
  ]);

  const setStatus = (sid: string, st: AttendanceStatus) =>
    setStatusMap((m) => ({ ...m, [sid]: st }));
  const setRemarks = (sid: string, r: string) => setRemarksMap((m) => ({ ...m, [sid]: r }));
  const bulkMark = (st: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      next[s._id] = st;
    });
    setStatusMap(next);
  };

  const counts = {
    P: students.filter((s) => statusMap[s._id] === 'P').length,
    A: students.filter((s) => statusMap[s._id] === 'A').length,
    L: students.filter((s) => statusMap[s._id] === 'L').length,
    other: students.filter((s) => !['P', 'A', 'L'].includes(statusMap[s._id])).length,
  };

  const submit = async () => {
    if (!selectedClass) return;
    if (!students.length) {
      toast.error('No students found for this class');
      return;
    }
    const entries = students.map((s) => ({
      studentId: s._id,
      rollNumber: s.rollNumber,
      status: statusMap[s._id] ?? 'P',
      remarks: remarksMap[s._id] || undefined,
    }));
    const body = {
      ...selectedClass,
      date: selectedClass.scheduledDate || date,
      entries,
    };
    const res = await mutation('attendance', {
      method: 'POST',
      body,
      silentError: true,
      returnError: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      const wasEditing = Boolean(attendanceForClass(selectedClass));
      toast.success(
        `Attendance ${wasEditing ? 'updated' : 'submitted'} for ${students.length} students`,
      );
      await Promise.all([
        refetchAttendance(),
        mutateCache((key) => Array.isArray(key) && String(key[0]).includes('attendance')),
        mutateCache((key) => Array.isArray(key) && String(key[0]).includes('dashboard')),
      ]);
      setSelectedClass(null);
      setStatusMap({});
      setRemarksMap({});
    } else {
      const payload = (res as { results?: { message?: string; error?: { message?: string } } })
        ?.results;
      toast.error(payload?.message || payload?.error?.message || 'Failed to submit attendance');
    }
  };

  if (selectedClass) {
    return (
      <RosterMarker
        cls={selectedClass}
        date={date}
        setDate={setDate}
        students={students}
        loading={stLoading}
        statusMap={statusMap}
        remarksMap={remarksMap}
        setStatus={setStatus}
        setRemarks={setRemarks}
        bulkMark={bulkMark}
        counts={counts}
        isEditing={Boolean(attendanceForClass(selectedClass))}
        onBack={() => setSelectedClass(null)}
        onSubmit={submit}
        submitting={isLoading}
        onRetry={() => refetchStudents()}
      />
    );
  }

  if (manualMode) {
    return (
      <ManualClassPicker
        ay={ay}
        onCancel={() => setManualMode(false)}
        onPick={(cls) => {
          setSelectedClass(cls);
          setManualMode(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
              Attendance command centre
            </span>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Scheduled teaching sessions</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Open a due session, verify the class roster and submit attendance within its permitted
              window.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-slate-500">
              <span className="text-primary">1 · Select session</span>
              <span className="h-px w-5 bg-slate-200" />
              <span>2 · Verify roster</span>
              <span className="h-px w-5 bg-slate-200" />
              <span>3 · Submit record</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-72">
            <p className="text-[10px] font-bold tracking-[0.14em] text-slate-600 uppercase">
              Working date range
            </p>
            <button
              type="button"
              onClick={(event) => {
                setDraftRange(rangeValue);
                setLeftCalendarMonth(startOfMonth(rangeValue[0]!));
                setRangeAnchor(event.currentTarget);
              }}
              className="flex w-full items-center justify-between gap-5 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
              aria-label="Select attendance date range"
            >
              <span>
                <span className="block text-sm font-bold text-slate-800">
                  {format(rangeValue[0]!, 'MMM d')} – {format(rangeValue[1]!, 'MMM d, yyyy')}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  {todayClasses.length} scheduled{' '}
                  {todayClasses.length === 1 ? 'session' : 'sessions'}
                </span>
              </span>
              <CalendarCheck2 className="h-5 w-5 shrink-0 text-primary" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3">
          <p className="text-xs text-slate-500">
            {dueCount > 0 ? (
              <>
                <strong className="text-amber-700">{dueCount} ready to record.</strong> Start with
                the earliest due session.
              </>
            ) : liveCount > 0 ? (
              <>
                <strong className="text-emerald-700">{liveCount} live now.</strong> Attendance opens
                when the session ends.
              </>
            ) : (
              <>
                <strong className="text-slate-700">No immediate action.</strong> Upcoming sessions
                remain visible for planning.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Popover
              open={Boolean(rangeAnchor)}
              anchorEl={rangeAnchor}
              onClose={() => setRangeAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  elevation: 0,
                  sx: {
                    mt: 1,
                    border: '1px solid #e2e8f0',
                    borderRadius: 3,
                    boxShadow: 'none',
                    maxWidth: 'calc(100vw - 24px)',
                  },
                },
              }}
            >
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <div className="max-w-full overflow-x-auto bg-white p-5">
                  <div className="mb-3 pl-2">
                    <p className="text-[10px] font-bold tracking-[0.14em] text-slate-600 uppercase">
                      Select date range
                    </p>
                    <p className="mt-1 text-xl font-medium text-slate-800">
                      {format(draftRange[0] ?? rangeValue[0]!, 'MMM d')} –{' '}
                      {format(draftRange[1] ?? rangeValue[1]!, 'MMM d')}
                    </p>
                  </div>
                  <div className="flex min-w-max items-start gap-4">
                    <div className="flex w-32 flex-col gap-2 pt-3">
                      {rangePresets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const [start, end] = preset.getValue();
                            applyRange(start, end);
                          }}
                          className="rounded-full bg-slate-100 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={resetRange}
                        className="w-fit rounded-full bg-slate-100 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="flex">
                      <DateCalendar
                        value={null}
                        referenceDate={leftCalendarMonth}
                        onMonthChange={(month) => setLeftCalendarMonth(startOfMonth(month))}
                        onChange={(selectedDay) => selectedDay && selectRangeDay(selectedDay)}
                        slotProps={{ day: (ownerState) => rangeDayProps(ownerState.day) }}
                        sx={{ '& .MuiPickersCalendarHeader-label': { fontWeight: 600 } }}
                      />
                      <DateCalendar
                        value={null}
                        referenceDate={addMonths(leftCalendarMonth, 1)}
                        onMonthChange={(month) =>
                          setLeftCalendarMonth(startOfMonth(addMonths(month, -1)))
                        }
                        onChange={(selectedDay) => selectedDay && selectRangeDay(selectedDay)}
                        slotProps={{ day: (ownerState) => rangeDayProps(ownerState.day) }}
                        sx={{ '& .MuiPickersCalendarHeader-label': { fontWeight: 600 } }}
                      />
                    </div>
                  </div>
                </div>
              </LocalizationProvider>
            </Popover>
            {isHod && (
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setMarkScope('my')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    markScope === 'my'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Assigned Classes
                </button>
                <button
                  type="button"
                  onClick={() => setMarkScope('department')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    markScope === 'department'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Department Schedule (Proxy)
                </button>
              </div>
            )}
            {isHod && (
              <CustomButton
                type="button"
                variant="secondary"
                onClick={() => setManualMode(true)}
                className="w-fit!"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Unscheduled Class
              </CustomButton>
            )}
          </div>
        </div>
      </div>

      {ttLoading ? (
        <AttendanceCardsSkeleton cards={4} />
      ) : todayClasses.length === 0 ? (
        <div className="grid items-center gap-6 overflow-hidden rounded-2xl bg-white p-5 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              Nothing to record for this date
            </span>
            <h3 className="mt-3 text-lg font-bold text-slate-900">No assigned class was found</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              {isHod
                ? 'Attendance is driven by published department timetables. To record attendance for other faculty, switch to "Department Schedule (Proxy)" or verify that faculty assignments and active sections are published.'
                : 'Attendance can be marked only from your approved timetable. Cards appear for published periods assigned to your faculty account. Try another date. If a class should appear, ask your HOD to verify the faculty assignment and student section/roster.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-lg bg-slate-100 px-3 py-2">1. Published timetable</span>
              <span className="rounded-lg bg-slate-100 px-3 py-2">2. Faculty assigned</span>
              <span className="rounded-lg bg-slate-100 px-3 py-2">3. Student roster active</span>
            </div>
            {canUseManualClass && (
              <CustomButton
                type="button"
                variant="secondary"
                onClick={() => setManualMode(true)}
                className="mt-4 w-fit!"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Approved extra class
              </CustomButton>
            )}
          </div>
          <div>
            <Image
              src="/images/attendance/attendance-management.png"
              alt="Digital attendance clipboard with calendar and clock"
              width={900}
              height={600}
              className="h-48 w-full rounded-xl object-cover"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  label: 'Assigned in range',
                  value: todayClasses.length,
                  icon: CalendarCheck2,
                  tone: 'text-primary bg-primary-50',
                  surface: 'bg-white',
                },
                {
                  label: 'Live now',
                  value: liveCount,
                  icon: CircleDot,
                  tone: 'text-emerald-700 bg-emerald-50',
                  surface: 'bg-white',
                },
                {
                  label: 'Upcoming',
                  value: upcomingCount,
                  icon: TimerReset,
                  tone: 'text-sky-700 bg-sky-50',
                  surface: 'bg-white',
                },
                {
                  label: 'Recorded',
                  value: todayClasses.filter((c) => Boolean(attendanceForClass(c))).length,
                  icon: CheckCircle,
                  tone: 'text-violet-700 bg-violet-50',
                  surface: 'bg-white',
                },
              ] satisfies Array<{
                label: string;
                value: number;
                icon: React.ElementType;
                tone: string;
                surface: string;
              }>
            ).map(({ label, value, icon: Icon, tone, surface }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`flex items-center gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:odd:border-r lg:border-b-0 lg:border-r lg:last:border-r-0 ${surface}`}
              >
                <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-lg font-black leading-none text-slate-900">
                    {value}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                </span>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <strong className="text-slate-900">Mark</strong> shows every scheduled session in this
              range. <strong className="text-slate-900">My Records</strong> shows only saved
              attendance records.
            </p>
            {missedCount > 0 && (
              <p className="font-semibold text-amber-700">
                {missedCount} {missedCount === 1 ? 'session has' : 'sessions have'} no record and
                passed the 24-hour submission limit.
              </p>
            )}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {todayClasses.map((c, i) => {
                const attendance = attendanceForClass(c);
                const status = classState(c);
                const editable = canEditRecordedClass(c);
                const classDate = c.scheduledDate ? new Date(`${c.scheduledDate}T00:00:00`) : new Date();
                const monthTheme = getMonthTheme(classDate);
                const isMissedAndLeadership = status === 'missed' && isLeadership;
                const canClick = status === 'due' || editable || isMissedAndLeadership;
                return (
                  <motion.button
                    key={`${c.scheduledDate}-${c.timetableSlotId || `${c.subjectId}-${c.periodNumber}`}`}
                    type="button"
                    onClick={() => {
                      if (!canClick) return;
                      setDate(c.scheduledDate ?? date);
                      setSelectedClass(c);
                    }}
                    disabled={!canClick}
                    aria-label={
                      status === 'missed'
                        ? `${c.subjectName}. Attendance was not recorded. Submission closed on ${formatSubmissionDeadline(c)}.`
                        : undefined
                    }
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={canClick ? { y: -2 } : undefined}
                    className={`group relative flex min-h-60 flex-col overflow-hidden rounded-2xl border bg-white p-4 text-left transition-colors ${status === 'due' ? 'border-amber-200 hover:border-amber-300 hover:bg-amber-50/20' : attendance ? 'border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/20' : status === 'missed' && isLeadership ? 'border-amber-300 hover:border-amber-400 hover:bg-amber-50/30' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/20'} ${canClick ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {status === 'live' && (
                      <motion.span
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 1.8, repeat: Infinity }}
                        className="absolute right-0 top-0 rounded-bl-xl bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase text-white"
                      >
                        Live
                      </motion.span>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`w-14 shrink-0 overflow-hidden rounded-xl border ${monthTheme.border} ${monthTheme.bg} text-center`}>
                          <span className={`block py-1 text-[9px] font-black tracking-wider uppercase ${monthTheme.headerBg} ${monthTheme.headerText}`}>
                            {c.scheduledDate
                              ? format(classDate, 'MMM')
                              : ''}
                          </span>
                          <span className={`block py-1.5 text-xl font-black leading-none ${monthTheme.numText}`}>
                            {c.scheduledDate
                              ? format(classDate, 'dd')
                              : ''}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block font-mono text-xs font-bold text-slate-700">
                            {c.subjectCode}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                            <CircleDot
                              className={`size-3 ${status === 'live' ? 'text-emerald-600' : status === 'due' ? 'text-amber-600' : attendance ? 'text-emerald-600' : status === 'missed' && isLeadership ? 'text-amber-600' : 'text-sky-600'}`}
                            />
                            {attendance
                              ? 'Attendance recorded'
                              : status === 'due'
                                ? 'Ready for attendance'
                                : status === 'live'
                                  ? 'Class in progress'
                                  : status === 'missed'
                                    ? isLeadership
                                      ? 'Submission closed · HOD override available'
                                      : 'Submission closed'
                                    : 'Scheduled next'}
                          </span>
                        </span>
                      </div>
                      <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500">
                        {c.classType}
                      </span>
                    </div>
                    <h3
                      className="mt-4 min-h-11 wrap-break-word text-base font-bold leading-snug text-slate-900"
                      title={c.subjectName}
                    >
                      {c.subjectName}
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                      <span className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 font-semibold text-slate-600">
                        <Clock className="size-3.5 text-primary" /> P{c.periodNumber} ·{' '}
                        {c.startTime}–{c.endTime}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-slate-500">
                        <Users className="size-3.5 text-primary" /> Sem {c.semester}
                        {c.section ? ` · Sec ${c.section}` : ''}
                      </span>
                      {c.facultyName && markScope === 'department' && (
                        <span className="col-span-2 flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-slate-700">
                          <User className="size-3.5 text-slate-400" />
                          <span className="text-slate-500 font-normal">Faculty:</span> {c.facultyName}
                        </span>
                      )}
                      <span className="col-span-2 flex min-w-0 items-center gap-1.5 px-1 text-slate-600">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {c.roomNo || 'Room not assigned'} · {c.program}
                        </span>
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-[9px] font-bold ${attendance
                            ? 'bg-emerald-50 text-emerald-700'
                            : status === 'upcoming'
                              ? 'bg-sky-50 text-sky-700'
                              : status === 'live'
                                ? 'bg-emerald-50 text-emerald-700'
                                : status === 'missed'
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-amber-50 text-amber-700'
                          }`}
                      >
                        {attendance
                          ? `${attendance.totalPresent ?? 0} present of ${attendance.totalStrength ?? 0}`
                          : status === 'upcoming'
                            ? `Starts at ${c.startTime}`
                            : status === 'live'
                              ? 'Class in progress'
                              : status === 'missed'
                                ? 'Closed · 24h limit'
                                : 'Attendance requires action'}
                      </span>
                      {status === 'due' && (
                        <span className="text-[10px] font-bold text-primary">Open roster →</span>
                      )}
                      {status === 'missed' && isLeadership && (
                        <span className="text-[10px] font-bold text-amber-700 hover:underline">
                          Open roster (HOD Override) →
                        </span>
                      )}
                      {attendance && editable && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                          Edit attendance →
                        </span>
                      )}
                      {attendance && !editable && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                          <CheckCircle className="size-3.5" /> Recorded
                        </span>
                      )}
                    </div>
                    {status === 'missed' && (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                        <strong className="block">
                          Submission window closed {formatSubmissionDeadline(c)}
                        </strong>
                        {isHod
                          ? 'As Department HOD, you have administrative permission to record late attendance or manage corrections.'
                          : isLeadership
                            ? 'As an academic administrator, you can record late attendance or approve backdated entries.'
                            : 'No record exists. Contact your HOD or academic administrator; direct late entry is unavailable.'}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-24">
              <div className="border-b border-slate-200 bg-blue-50/50 px-4 py-3">
                <p className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
                  Range insights
                </p>
                <p className="mt-1 text-xs text-slate-500">Live completion and presence signals</p>
              </div>
              <section className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Recording progress</h3>
                    <p className="mt-1 text-[10px] text-slate-600">Selected range completion</p>
                  </div>
                  <span className="text-xl font-black text-primary">{recordingRate}%</span>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative flex size-24 shrink-0 items-center justify-center">
                    <svg
                      viewBox="0 0 44 44"
                      className="absolute inset-0 -rotate-90"
                      aria-hidden="true"
                    >
                      <circle cx="22" cy="22" r="17" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                      <motion.circle
                        cx="22"
                        cy="22"
                        r="17"
                        fill="none"
                        stroke="#0178d7"
                        strokeWidth="5"
                        strokeLinecap="round"
                        pathLength="100"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: recordingRate / 100 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                      />
                    </svg>
                    <span className="text-lg font-black text-slate-900">
                      {recordedCount}/{todayClasses.length}
                    </span>
                  </div>
                  <div className="space-y-2 text-[10px] text-slate-500">
                    <p className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary" /> Recorded sessions
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-slate-200" /> Remaining sessions
                    </p>
                  </div>
                </div>
              </section>

              <section className="border-t border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Student presence</h3>
                    <p className="mt-1 text-[10px] text-slate-600">Across recorded sessions</p>
                  </div>
                  <span className="text-xl font-black text-emerald-600">{presenceRate}%</span>
                </div>
                <motion.svg
                  viewBox="0 0 280 132"
                  className="mt-4 h-32 w-full"
                  role="img"
                  aria-label={`Student attendance chart: ${attendanceTotals.present} present, ${attendanceTotals.absent} absent, ${attendanceTotals.late} late and ${attendanceTotals.other} other entries`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  <line x1="12" y1="102" x2="268" y2="102" stroke="#e2e8f0" strokeWidth="1" />
                  {[
                    { label: 'Present', value: attendanceTotals.present, x: 28, color: '#10b981' },
                    { label: 'Absent', value: attendanceTotals.absent, x: 92, color: '#fb7185' },
                    { label: 'Late', value: attendanceTotals.late, x: 156, color: '#f59e0b' },
                    { label: 'Other', value: attendanceTotals.other, x: 220, color: '#8b5cf6' },
                  ].map((bar) => {
                    const maximum = Math.max(
                      attendanceTotals.present,
                      attendanceTotals.absent,
                      attendanceTotals.late,
                      attendanceTotals.other,
                      1,
                    );
                    const height = bar.value === 0 ? 4 : Math.max(10, (bar.value / maximum) * 66);
                    return (
                      <g key={bar.label}>
                        <rect
                          x={bar.x}
                          y={102 - height}
                          width="32"
                          height={height}
                          rx="8"
                          fill={bar.color}
                        />
                        <text
                          x={bar.x + 16}
                          y={Math.max(14, 96 - height)}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill="#334155"
                        >
                          {bar.value}
                        </text>
                        <text
                          x={bar.x + 16}
                          y="120"
                          textAnchor="middle"
                          fontSize="8"
                          fill="#64748b"
                        >
                          {bar.label}
                        </text>
                      </g>
                    );
                  })}
                </motion.svg>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px]">
                  <span className="text-slate-500">Recorded attendance entries</span>
                  <strong className="text-slate-800">{attendanceTotals.strength}</strong>
                </div>
              </section>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarkAttendancePanel;

'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import { ITimetable, TDay } from '../types/timetable.types';

const DAYS: TDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface IProps {
  timetable: ITimetable;
  onClose: () => void;
}

interface IInstitutionSetting {
  name?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
}

const displayDate = (value?: string) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');
const timeMinutes = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  return hour * 60 + minute;
};
const displayTime = (value: string) => {
  const total = timeMinutes(value);
  const hour = Math.floor(total / 60);
  const minute = String(total % 60).padStart(2, '0');
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const twelveHour = hour % 12 || 12;
  return `${String(twelveHour).padStart(2, '0')}:${minute}${suffix}`;
};
const ordinal = (value: number) => {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}TH`;
  return `${value}${value % 10 === 1 ? 'ST' : value % 10 === 2 ? 'ND' : value % 10 === 3 ? 'RD' : 'TH'}`;
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 4) || 'TBA';
const facultyShortCode = (slot: ITimetable['slots'][number]) => initials(slot.facultyName);
const label = (slot: ITimetable['slots'][number]) =>
  slot.slotKind === 'break' || slot.slotKind === 'activity'
    ? slot.title || slot.subjectName
    : `${slot.isCombined ? slot.subjectName : slot.subjectShortName || slot.subjectCode}${slot.labBatch ? `-${slot.labBatch}` : ''} (${facultyShortCode(slot)})`;

export default function TimetablePrintView({ timetable, onClose }: IProps) {
  const { data: institutionRaw, isLoading: institutionLoading } = useSwr<{
    success: boolean;
    data?: IInstitutionSetting;
  }>('institution-setting/public');
  const institution = institutionRaw?.data;
  const institutionReady = Boolean(institution?.name?.trim() && institution?.address?.trim());
  const timetableReady = Boolean(
    timetable.effectiveFrom && timetable.academicYear && timetable.program,
  );
  const printReady = institutionReady && timetableReady;
  const starts = [...new Set(timetable.slots.map((slot) => slot.startTime))].sort(
    (left, right) => timeMinutes(left) - timeMinutes(right),
  );
  const finalEnd = timetable.slots.reduce(
    (latest, slot) => (timeMinutes(slot.endTime) > timeMinutes(latest) ? slot.endTime : latest),
    starts[0] ?? '17:00',
  );
  const boundaries = [...starts, finalEnd];
  const segments = starts.map((start, index) => ({
    start,
    end: starts[index + 1] ?? finalEnd,
  }));
  const lunchSegments = new Set(
    timetable.slots
      .filter(
        (slot) => slot.slotKind === 'break' && /lunch/i.test(slot.title || slot.subjectName || ''),
      )
      .map((slot) => slot.startTime),
  );
  const normalSegmentCount = Math.max(1, segments.length - lunchSegments.size);
  const normalSegmentWidth = (88 - lunchSegments.size * 4) / normalSegmentCount;
  const deptCode = typeof timetable.departmentId === 'object' ? timetable.departmentId.code : '';
  const branches = timetable.branches?.length
    ? timetable.branches
    : [deptCode || timetable.program || 'Main'];
  const assignmentGroups = new Map<
    string,
    {
      shortName: string;
      subjectName: string;
      branchLabel: string;
      faculty: Set<string>;
    }
  >();
  timetable.slots
    .filter((slot) => (slot.slotKind ?? 'teaching') === 'teaching' && slot.subjectName)
    .forEach((slot) => {
      const branchLabel = slot.isCombined
        ? (slot.branches?.length ? slot.branches : branches).join(' & ')
        : slot.branch || slot.branches?.[0] || '';
      const shortName = slot.subjectShortName || slot.subjectCode;
      const key = `${slot.subjectId || slot.subjectCode}|${slot.subjectName}|${branchLabel}`;
      const group = assignmentGroups.get(key) ?? {
        shortName,
        subjectName: slot.subjectName,
        branchLabel,
        faculty: new Set<string>(),
      };
      group.faculty.add(
        slot.facultyName
          ? `${slot.facultyName} (${facultyShortCode(slot)})`
          : 'Faculty not assigned',
      );
      assignmentGroups.set(key, group);
    });
  const assignmentDetails = [...assignmentGroups.values()]
    .map(
      ({ shortName, branchLabel, subjectName, faculty }) =>
        `${shortName}${branchLabel ? ` (${branchLabel})` : ''}: ${subjectName} — ${[...faculty].sort((left, right) => left.localeCompare(right)).join(', ')}`,
    )
    .sort((left, right) => left.localeCompare(right));
  const assignmentColumnSize = Math.ceil(assignmentDetails.length / 2);
  const preparedBy =
    typeof timetable.createdBy === 'object' ? timetable.createdBy.name?.trim() : '';
  const approvedBy =
    typeof timetable.approvedBy === 'object' ? timetable.approvedBy.name?.trim() : '';
  const signatories = [
    preparedBy ? { role: 'Prepared By', name: preparedBy } : null,
    timetable.isApproved && approvedBy ? { role: 'Dean Academic', name: approvedBy } : null,
  ].filter((entry): entry is { role: string; name: string } => Boolean(entry));
  const slotsAt = (day: TDay, branch: string, start: string) =>
    timetable.slots.filter(
      (slot) =>
        slot.day === day &&
        slot.startTime === start &&
        (slot.branch === branch || slot.isCombined || !slot.branch),
    );
  const slotGroupKey = (slots: ITimetable['slots']) =>
    slots
      .map((slot) => `${slot.endTime}|${label(slot)}`)
      .sort()
      .join('||');

  const renderDayRows = (day: TDay, dayIndex: number) => {
    const occupied = new Set<string>();
    return branches.map((branch, branchIndex) => {
      const cells: React.ReactNode[] = [];
      for (let index = 0; index < segments.length; index += 1) {
        if (occupied.has(`${branchIndex}:${index}`)) continue;
        const start = segments[index]!.start;
        if (lunchSegments.has(start)) {
          if (dayIndex === 0 && branchIndex === 0) {
            cells.push(
              <td
                key="weekly-lunch"
                rowSpan={DAYS.length * branches.length}
                className="relative border border-slate-700 p-0 text-center align-middle"
              >
                <strong className="absolute inset-0 flex flex-col items-center justify-evenly py-5 text-[10px] leading-none">
                  {'LUNCH'.split('').map((letter, letterIndex) => (
                    <span key={`${letter}-${letterIndex}`}>{letter}</span>
                  ))}
                </strong>
              </td>,
            );
          }
          continue;
        }
        const slots = slotsAt(day, branch, start);
        if (!slots.length) {
          cells.push(<td key={start} className="border border-slate-700 p-1.5" />);
          continue;
        }
        const end = slots.reduce(
          (latest, slot) => (slot.endTime > latest ? slot.endTime : latest),
          slots[0]!.endTime,
        );
        const endIndex = boundaries.findIndex(
          (boundary) => timeMinutes(boundary) >= timeMinutes(end),
        );
        const colSpan = Math.max(1, endIndex - index);
        const groupKey = slotGroupKey(slots);
        let rowSpan = 1;
        for (
          let nextBranchIndex = branchIndex + 1;
          nextBranchIndex < branches.length;
          nextBranchIndex += 1
        ) {
          const matching = slotsAt(day, branches[nextBranchIndex]!, start);
          if (!matching.length || slotGroupKey(matching) !== groupKey) break;
          rowSpan += 1;
        }
        for (let row = branchIndex; row < branchIndex + rowSpan; row += 1) {
          for (let column = index; column < index + colSpan; column += 1) {
            occupied.add(`${row}:${column}`);
          }
        }
        cells.push(
          <td
            key={start}
            colSpan={colSpan}
            rowSpan={rowSpan}
            className="border border-slate-700 p-1.5 text-center align-middle whitespace-pre-line"
          >
            {slots.map((slot) => (
              <div
                key={`${slot.periodNo}-${slot.labBatch ?? 'all'}-${slot.subjectCode}`}
                className="mb-1 leading-tight last:mb-0"
              >
                {(slot.slotKind ?? 'teaching') === 'teaching' ? (
                  <strong className="block text-[9px] uppercase">{label(slot)}</strong>
                ) : (
                  <strong className="block text-[9px] uppercase">
                    {slot.slotKind === 'break' &&
                    /lunch/i.test(slot.title || slot.subjectName || '') ? (
                      <span className="mx-auto flex flex-col items-center gap-0.5 leading-none">
                        {'LUNCH'.split('').map((letter, index) => (
                          <span key={`${letter}-${index}`}>{letter}</span>
                        ))}
                      </span>
                    ) : (
                      slot.title || slot.subjectName
                    )}
                  </strong>
                )}
              </div>
            ))}
          </td>,
        );
      }
      return (
        <tr
          key={`${day}-${branch}`}
          className={dayIndex % 2 === 1 ? 'bg-slate-100/70' : 'bg-white'}
        >
          {branchIndex === 0 && (
            <th
              rowSpan={branches.length}
              className="border border-slate-700 p-1.5 text-center align-middle"
            >
              {day.slice(0, 3).toUpperCase()}
            </th>
          )}
          <th className="border border-slate-700 p-1.5">{branch}</th>
          {cells}
        </tr>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-80 overflow-auto bg-slate-200/80 p-4 print:static print:bg-white print:p-0">
      <div className="mx-auto max-w-[1400px] rounded-2xl bg-white p-6  print:max-w-none print:rounded-none print:p-0 print:">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <div>
            <h2 className="text-lg font-bold text-slate-900">OFFICIAL PRINT PREVIEW</h2>
            <p className="text-sm text-slate-500">
              Landscape format · use the browser print dialog to save PDF.
            </p>
            {!institutionLoading && !institutionReady && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Complete the institution name and address in Settings before printing.
              </p>
            )}
            {!institutionLoading && institutionReady && !timetableReady && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Add the timetable effective date before printing the official copy.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <CustomButton
              startIcon={<Printer className="h-4 w-4" />}
              onClick={() => window.print()}
              disabled={institutionLoading || !printReady}
            >
              {institutionLoading ? 'Loading Institution…' : 'Print / Save PDF'}
            </CustomButton>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <article className="print-sheet text-slate-950">
          <header className="mb-4 text-center">
            <p className="text-[13px] font-extrabold uppercase tracking-wide">
              {institution?.name || 'Institution setup required'}
            </p>
            <p className="mt-0.5 text-[8px]">{institution?.address || 'Address setup required'}</p>
            <div className="mt-2 grid grid-cols-[1fr_3fr_1fr] items-end gap-3 text-[10px] font-semibold">
              <span className="pb-0.5 text-left">
                With effect from: {displayDate(timetable.effectiveFrom)}
              </span>
              <div>
                <h1 className="text-[11px] font-extrabold uppercase underline underline-offset-2">
                  {`Timetable (${ordinal(timetable.semester)} Semester ${timetable.program})`}
                </h1>
                {timetable.section && timetable.section !== 'All Sections' && (
                  <p className="mt-1 text-[9px]">Section: {timetable.section}</p>
                )}
              </div>
              <span className="pb-0.5 text-right">
                Session: {timetable.academicYear} ({timetable.semesterType.toUpperCase()} SEMESTER)
              </span>
            </div>
          </header>
          <table className="w-full table-fixed border-collapse text-[10px]">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '7%' }} />
              {segments.map((segment) => (
                <col
                  key={`column-${segment.start}`}
                  style={{
                    width: `${lunchSegments.has(segment.start) ? 4 : normalSegmentWidth}%`,
                  }}
                />
              ))}
            </colgroup>
            <thead className="bg-slate-200/80">
              <tr>
                <th className="border border-slate-700 p-1.5">Day / Time</th>
                <th className="border border-slate-700 p-1.5">Branch</th>
                {segments.map((time) => {
                  const isLunch = lunchSegments.has(time.start);
                  return (
                    <th
                      key={time.start}
                      className={`border border-slate-700 text-center align-middle ${isLunch ? 'px-0.5 py-1 leading-tight' : 'p-1.5'}`}
                    >
                      {isLunch ? (
                        <span className="flex min-w-0 flex-col items-center justify-center">
                          <span className="whitespace-nowrap">{displayTime(time.start)}</span>
                          <span className="my-0.5">–</span>
                          <span className="whitespace-nowrap">{displayTime(time.end)}</span>
                        </span>
                      ) : (
                        <span className="whitespace-nowrap">
                          {displayTime(time.start)} – {displayTime(time.end)}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>{DAYS.flatMap((day, dayIndex) => renderDayRows(day, dayIndex))}</tbody>
          </table>
          {assignmentDetails.length > 0 && (
            <section className="mt-3 grid grid-cols-2 border border-slate-700 text-[8px] leading-snug">
              {[0, 1].map((column) => (
                <div
                  key={column}
                  className={column === 0 ? 'border-r border-slate-700 p-2' : 'p-2'}
                >
                  <ul className="space-y-1">
                    {assignmentDetails
                      .slice(column * assignmentColumnSize, (column + 1) * assignmentColumnSize)
                      .map((detail) => (
                        <li key={detail} className="flex gap-1">
                          <span aria-hidden="true">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          <p className="mt-2 text-[8px] text-slate-600">
            Cell format: Subject abbreviation (Faculty initials). Assignment details are listed
            above.
          </p>
          {timetable.documentNo && (
            <p className="mt-1 text-[8px] text-slate-600">Reference: {timetable.documentNo}</p>
          )}
          {signatories.length > 0 && (
            <footer
              className="mt-8 grid text-center text-[10px] font-semibold"
              style={{ gridTemplateColumns: `repeat(${signatories.length}, minmax(0, 1fr))` }}
            >
              {signatories.map((signatory) => (
                <div key={signatory.role}>
                  <p className="font-bold">{signatory.name}</p>
                  <p className="mt-1 text-[9px] text-slate-600">{signatory.role}</p>
                </div>
              ))}
            </footer>
          )}
        </article>
      </div>
    </div>
  );
}

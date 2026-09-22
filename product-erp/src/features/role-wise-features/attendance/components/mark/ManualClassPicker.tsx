/**
 * @file ManualClassPicker.tsx
 * @description Fallback manual class and section picker for marking unscheduled or extra sessions.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import type { ClassType, ISelectedClass } from '../../types/attendance.types';
import { CLASS_TYPES, inputCls, labelCls } from '../../utils/attendance.constants';

interface IDeptOption {
  _id: string;
  name: string;
  code: string;
}

interface ISubjectOption {
  _id: string;
  code: string;
  name: string;
  semester?: number;
  program?: string;
  departmentId?: string;
}

export function ManualClassPicker({
  ay,
  onCancel,
  onPick,
}: {
  ay: string;
  onCancel: () => void;
  onPick: (cls: ISelectedClass) => void;
}) {
  const [departmentId, setDepartmentId] = useState('');
  const [program, setProgram] = useState('B.Tech');
  const [semester, setSemester] = useState(1);
  const [section, setSection] = useState('A');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classType, setClassType] = useState<ClassType>('Lecture');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [periodNumber, setPeriodNumber] = useState(1);

  const { data: deptRaw } = useSwr('department');
  const departments: IDeptOption[] = (deptRaw as { data?: IDeptOption[] })?.data ?? [];

  const subjQuery =
    departmentId && semester ? `subject?departmentId=${departmentId}&limit=200` : null;
  const { data: subjRaw } = useSwr(subjQuery);
  const subjectsResp = (subjRaw as { data?: ISubjectOption[] | { data?: ISubjectOption[] } })?.data;
  const subjects: ISubjectOption[] = Array.isArray(subjectsResp)
    ? subjectsResp
    : ((subjectsResp as { data?: ISubjectOption[] } | undefined)?.data ?? []);
  const selectedSubject = subjects.find((s) => s._id === subjectId);
  const selectedDept = departments.find((d) => d._id === departmentId);

  const canSubmit = !!(
    sectionId &&
    departmentId &&
    program &&
    semester &&
    section &&
    subjectId &&
    startTime &&
    endTime &&
    periodNumber
  );

  const proceed = () => {
    if (!selectedSubject || !selectedDept) {
      toast.error('Select department and subject');
      return;
    }
    onPick({
      sectionId: sectionId || undefined,
      subjectId: selectedSubject._id,
      subjectCode: selectedSubject.code,
      subjectName: selectedSubject.name,
      departmentId,
      program,
      branch: selectedDept.code,
      semester,
      section,
      academicYear: ay,
      startTime,
      endTime,
      periodNumber,
      classType,
    });
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" /> Back to today&apos;s classes
      </button>
      <div className="space-y-4 rounded-2xl bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Pick a Class</h2>
          <p className="mt-0.5 text-xs text-slate-500">For unscheduled / extra sessions</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <AsyncSelect
              label="Section / Class"
              type="sections"
              params={{ master: true }}
              value={sectionId || null}
              onChange={(v, opt) => {
                setSectionId(v ?? '');
                if (opt?.label) {
                  const sem = opt.label.match(/Sem\s+(\d+)/i)?.[1];
                  const sectionName = opt.label.split(' - ').pop();
                  const parts = opt.label.split(' ');
                  if (parts[0]) setProgram(parts[0]);
                  if (sem) setSemester(Number(sem));
                  if (sectionName) setSection(sectionName);
                }
                setSubjectId('');
              }}
            />
          </div>
          <AsyncSelect
            label="Department"
            type="departments"
            required
            value={departmentId}
            onChange={(v) => {
              setDepartmentId(v ?? '');
              setSubjectId('');
            }}
          />
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 lg:col-span-2">
            Program, semester and section are taken automatically from the selected class.
          </div>
          <div className="lg:col-span-2">
            <label className={labelCls}>Subject *</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!departmentId}
              className={inputCls + ' disabled:cursor-not-allowed disabled:opacity-50'}
            >
              <option value="">
                {departmentId
                  ? subjects.length
                    ? 'Select subject'
                    : 'No subjects found'
                  : 'Select department first'}
              </option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Class Type</label>
            <select
              value={classType}
              onChange={(e) => setClassType(e.target.value as ClassType)}
              className={inputCls}
            >
              {CLASS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Period *</label>
            <select
              value={periodNumber}
              onChange={(e) => setPeriodNumber(Number(e.target.value))}
              className={inputCls}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  Period {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Start Time *</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>End Time *</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Academic Year</label>
            <input value={ay} disabled className={inputCls + ' bg-slate-100'} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <CustomButton type="button" variant="tertiary" onClick={onCancel} className="w-fit!">
            Cancel
          </CustomButton>
          <CustomButton
            type="button"
            variant="primary"
            onClick={proceed}
            disabled={!canSubmit}
            className="w-fit!"
          >
            Continue
          </CustomButton>
        </div>
      </div>
    </div>
  );
}

export default ManualClassPicker;

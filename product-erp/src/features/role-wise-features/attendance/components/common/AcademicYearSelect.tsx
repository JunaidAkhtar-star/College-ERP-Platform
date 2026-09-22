/**
 * @file AcademicYearSelect.tsx
 * @description Academic year dropdown selector for attendance queries.
 * @module features/attendance
 */

'use client';

import React from 'react';
import AsyncSelect from '@/shared/core/AsyncSelect';

export function AcademicYearSelect({
  value,
  onChange,
  label = 'Academic Year',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <AsyncSelect
      type="academicYears"
      label={label}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      placeholder="Select academic year"
      emptyMessage="No configured academic years were found"
      className={className}
    />
  );
}

export default AcademicYearSelect;

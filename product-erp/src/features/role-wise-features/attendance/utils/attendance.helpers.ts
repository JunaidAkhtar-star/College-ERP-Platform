/**
 * @file attendance.helpers.ts
 * @description Date formatters, CSV exporters, and utility functions for attendance.
 * @module features/attendance
 */

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function currentAcademicYear(value = new Date()) {
  const y = value.getFullYear();
  const start = value.getMonth() >= 5 ? y : y - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export const localDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export const normalizeDateKey = (value: string | Date | undefined): string => {
  if (!value) return '';
  if (value instanceof Date) {
    return localDateKey(value);
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    try {
      const dateObj = new Date(value);
      const inFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return inFormatter.format(dateObj);
    } catch {
      return localDateKey(new Date(value));
    }
  }
  return '';
};

export function extractId(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj._id) return String(obj._id);
    if (typeof obj.toString === 'function') {
      const str = obj.toString();
      if (str !== '[object Object]') return str;
    }
  }
  return String(val);
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

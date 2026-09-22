/**
 * @file CorrectionModal.tsx
 * @description Modal dialog for students to submit attendance correction requests.
 * @module features/attendance
 */

'use client';

import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import type { AttendanceStatus, IAttendanceRecord } from '../../types/attendance.types';
import {
  inputCls,
  labelCls,
  STATUS_COLORS,
  STATUS_INACTIVE,
  STATUS_LABELS,
  STATUSES,
} from '../../utils/attendance.constants';
import { fmtDate, localDateKey } from '../../utils/attendance.helpers';

export function CorrectionModal({ onClose }: { onClose: () => void }) {
  const { mutation, isLoading } = useMutation();
  const to = localDateKey(new Date());
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 60);
  const from = localDateKey(fromDate);
  const { data: recordsRaw, isLoading: recordsLoading } = useSwr(
    `attendance/my/records?from=${from}&to=${to}`,
  );
  const eligibleRecords: IAttendanceRecord[] =
    (recordsRaw as { data?: IAttendanceRecord[] })?.data ?? [];
  const formik = useFormik({
    initialValues: {
      attendanceRecordId: '',
      requestedStatus: 'P' as AttendanceStatus,
      reason: '',
    },
    validationSchema: Yup.object({
      attendanceRecordId: Yup.string().trim().required('Select an attendance session'),
      requestedStatus: Yup.string().required(),
      reason: Yup.string().trim().min(10, 'Min 10 characters').required('Reason required'),
    }),
    onSubmit: async (values) => {
      const res = await mutation(`attendance/${values.attendanceRecordId}/correction`, {
        method: 'POST',
        body: { requestedStatus: values.requestedStatus, reason: values.reason },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Correction request submitted');
        onClose();
      } else toast.error('Failed');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Request Correction</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Attendance Session *</label>
            <select
              name="attendanceRecordId"
              value={formik.values.attendanceRecordId}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={recordsLoading}
              className={inputCls}
            >
              <option value="">
                {recordsLoading ? 'Loading your attendance…' : 'Select subject and class date'}
              </option>
              {eligibleRecords.map((record) => {
                const ownEntry = record.entries[0];
                const pending = record.correctionRequests?.some(
                  (request) => (request.status ?? 'pending') === 'pending',
                );
                return (
                  <option key={record._id} value={record._id} disabled={pending}>
                    {fmtDate(record.date)} · {record.subjectCode} · Period {record.periodNumber} ·{' '}
                    {STATUS_LABELS[ownEntry?.status ?? 'A']}
                    {pending ? ' · Request pending' : ''}
                  </option>
                );
              })}
            </select>
            {formik.touched.attendanceRecordId && formik.errors.attendanceRecordId && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.attendanceRecordId}</p>
            )}
            {!recordsLoading && eligibleRecords.length === 0 && (
              <p className="mt-1 text-xs text-slate-600">
                No attendance sessions were found in the last 60 days.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Requesting Status *</label>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => formik.setFieldValue('requestedStatus', s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${formik.values.requestedStatus === s ? STATUS_COLORS[s] : STATUS_INACTIVE}`}
                  title={STATUS_LABELS[s]}
                >
                  {s} — {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Reason *</label>
            <textarea
              name="reason"
              rows={4}
              value={formik.values.reason}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="Explain the reason for correction…"
              className={inputCls + ' resize-none'}
            />
            {formik.touched.reason && formik.errors.reason && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.reason}</p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Submit Request
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default CorrectionModal;

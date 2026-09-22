/**
 * @file CorrectionsPanel.tsx
 * @description Admin and HOD review panel for approving or rejecting student attendance correction requests.
 * @module features/attendance
 */

'use client';

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import type { IAttendanceRecord } from '../../types/attendance.types';
import { STATUS_LABELS } from '../../utils/attendance.constants';
import { fmtDate } from '../../utils/attendance.helpers';
import AttendanceCardsSkeleton from '../common/AttendanceCardsSkeleton';

export function CorrectionsPanel() {
  const { data: raw, isLoading, mutate } = useSwr('attendance/corrections');
  const records: IAttendanceRecord[] = (raw as { data?: IAttendanceRecord[] })?.data ?? [];
  const { mutation } = useMutation();

  const handleApprove = async (recordId: string, idx: number) => {
    const r = await Swal.fire({
      title: 'Approve correction?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`attendance/${recordId}/correction/${idx}/approve`, {
      method: 'PUT',
      body: {},
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Correction approved');
      mutate();
    } else toast.error('Failed');
  };

  const handleReject = async (recordId: string, idx: number) => {
    const result = await Swal.fire({
      title: 'Reject correction?',
      input: 'textarea',
      inputLabel: 'Reason',
      inputPlaceholder: 'Explain why this request is being rejected',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Please provide at least 5 characters' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    const res = await mutation(`attendance/${recordId}/correction/${idx}/reject`, {
      method: 'PUT',
      body: { reason: result.value },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Correction rejected');
      mutate();
    } else toast.error('Failed to reject correction');
  };

  const pending = records.flatMap((rec) =>
    (rec.correctionRequests ?? [])
      .map((request, idx) => ({ rec, request, idx }))
      .filter(({ request }) => (request.status ?? 'pending') === 'pending'),
  );

  if (!pending.length && !isLoading)
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-12">
        <CheckCircle className="h-10 w-10 text-slate-200 mb-2" />
        <p className="text-sm text-slate-600">No pending corrections</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {isLoading ? (
        <AttendanceCardsSkeleton cards={2} />
      ) : (
        pending.map(({ rec, request, idx }) => {
          const student =
            typeof request.studentId === 'object' ? request.studentId : { _id: request.studentId };
          const entry = rec.entries.find((e) => e.studentId === student._id);
          return (
            <div
              key={`${rec._id}-${idx}`}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {student.name || request.studentName || 'Student record unavailable'}{' '}
                  <span className="font-mono text-xs text-slate-600">
                    ({entry?.rollNumber ?? request.rollNumber ?? '—'})
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {rec.subjectCode} · {fmtDate(rec.date)} · P{rec.periodNumber} · Current:{' '}
                  <span className="font-bold text-slate-600">{entry?.status ?? '—'}</span> →
                  Requesting:{' '}
                  <span className="font-bold text-primary">
                    {request.requestedStatus} ({STATUS_LABELS[request.requestedStatus]})
                  </span>
                </p>
                <p className="mt-0.5 text-xs italic text-slate-500">
                  &ldquo;{request.reason}&rdquo;
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <CustomButton
                  variant="cancel"
                  onClick={() => handleReject(rec._id, idx)}
                  className="w-fit! py-1.5! text-xs!"
                >
                  Reject
                </CustomButton>
                <CustomButton
                  variant="primary"
                  onClick={() => handleApprove(rec._id, idx)}
                  className="w-fit! py-1.5! text-xs!"
                >
                  Approve
                </CustomButton>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default CorrectionsPanel;

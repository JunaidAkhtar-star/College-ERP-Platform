/**
 * @file HostelPage.tsx
 * @description Hostel management — rooms, allocations, visitors, complaints.
 *
 * APIs:
 *  GET  hostel/rooms
 *  PUT  hostel/rooms/:id
 *  GET  hostel/allocations
 *  PUT  hostel/allocations/:id/vacate
 *  GET/POST  hostel/visitors
 *  PUT  hostel/visitors/:id/checkout
 *  GET/POST  hostel/complaints
 *  PUT  hostel/complaints/:id
 * @module features/role-wise-features/hostel
 */

'use client';

import React, { useState, useMemo } from 'react';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import {
  Building2,
  Users,
  DoorOpen,
  Wrench,
  UserCheck,
  AlertCircle,
  Plus,
  CheckCircle,
  Receipt,
  Wallet,
  RefreshCw,
  Edit2,
  X,
  Info,
  Bed,
} from 'lucide-react';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import AsyncSelect from '@/shared/core/AsyncSelect';
import {
  IHostelRoom,
  IHostelAllocation,
  TRoomStatus,
  TAllocationStatus,
} from '../types/hostel.types';

type TTab = 'rooms' | 'allocations' | 'visitors' | 'complaints' | 'fees';

interface IHostelFeeRow {
  _id: string;
  studentId: string | { _id: string; name?: string; rollNumber?: string };
  allocationId: string | { _id: string; roomNumber?: string };
  academicYear: string;
  month: string;
  monthlyFee: number;
  messFee: number;
  otherCharges: number;
  totalDue: number;
  paidAmount: number;
  dueDate: string;
  paidDate?: string;
  paymentMode?: 'cash' | 'online' | 'dd' | 'cheque';
  receiptNo?: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  [k: string]: unknown;
}

const ROOM_STATUS: Record<TRoomStatus, { label: string; bg: string; text: string; dot: string }> = {
  available: { label: 'Available', bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
  full: { label: 'Full', bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-400' },
  maintenance: {
    label: 'Maintenance',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    dot: 'bg-amber-400',
  },
};

const ALLOC_STATUS: Record<
  TAllocationStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  active: { label: 'Active', bg: 'bg-secondary-50', text: 'text-secondary', dot: 'bg-secondary' },
  vacated: { label: 'Vacated', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
  transferred: {
    label: 'Transferred',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    dot: 'bg-blue-400',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface IVisitor {
  _id: string;
  studentName: string;
  visitorName: string;
  relation: string;
  visitorPhone: string;
  purpose: string;
  checkIn: string;
  checkOut?: string;
  [key: string]: unknown;
}

interface IComplaint {
  _id: string;
  studentName?: string;
  studentId?: string | { _id: string; name?: string };
  category: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  [key: string]: unknown;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

// ─── Add Visitor Modal ────────────────────────────────────────────────────────
function AddVisitorModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      studentId: '',
      visitorName: '',
      relation: '',
      visitorPhone: '',
      purpose: '',
      idProofType: '',
      idProofNo: '',
    },
    validationSchema: Yup.object({
      studentId: Yup.string().required('Select a resident student'),
      visitorName: Yup.string()
        .trim()
        .min(2, 'Min 2 characters')
        .max(120)
        .required('Visitor name is required'),
      relation: Yup.string()
        .trim()
        .min(2, 'Min 2 characters')
        .max(80)
        .required('Relation is required'),
      visitorPhone: Yup.string()
        .trim()
        .matches(/^[0-9+() -]{7,20}$/, 'Enter a valid phone number (7-20 digits)')
        .required('Phone number is required'),
      purpose: Yup.string().trim().max(500, 'Max 500 characters'),
      idProofType: Yup.string().oneOf([
        '',
        'aadhaar',
        'passport',
        'driving_license',
        'voter_id',
        'other',
      ]),
      idProofNo: Yup.string().trim().max(100, 'Max 100 characters'),
    }),
    onSubmit: async (values) => {
      const res = await mutation('hostel/visitors', {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if (res) {
        onSaved();
        onClose();
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">Log Hostel Visitor Check-In</h3>
        <p className="mt-1 text-xs text-slate-500">
          Record guest details and identity proof for resident safety and gate check-in logs.
        </p>

        <form onSubmit={formik.handleSubmit} className="mt-4 space-y-4">
          <AsyncSelect
            type="students"
            label="Hostel Resident Student *"
            value={formik.values.studentId || null}
            onChange={(value) => formik.setFieldValue('studentId', value ?? '')}
            placeholder="Search resident student by name or roll number..."
            required
          />
          {formik.touched.studentId && formik.errors.studentId && (
            <p className="text-xs font-medium text-red-500">{formik.errors.studentId}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Visitor Full Name *</label>
              <input
                className={inputCls}
                placeholder="e.g. Rajesh Kumar"
                {...formik.getFieldProps('visitorName')}
              />
              {formik.touched.visitorName && formik.errors.visitorName && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.visitorName}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Relation to Student *</label>
              <input
                className={inputCls}
                placeholder="e.g. Father, Mother, Sibling"
                {...formik.getFieldProps('relation')}
              />
              {formik.touched.relation && formik.errors.relation && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.relation}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Contact Phone Number *</label>
              <input
                className={inputCls}
                placeholder="e.g. +91 98765 43210"
                {...formik.getFieldProps('visitorPhone')}
              />
              {formik.touched.visitorPhone && formik.errors.visitorPhone && (
                <p className="mt-1 text-xs font-medium text-red-500">
                  {formik.errors.visitorPhone}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Visit Purpose</label>
              <input
                className={inputCls}
                placeholder="e.g. Delivering study materials"
                {...formik.getFieldProps('purpose')}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Govt ID Proof Type</label>
              <select className={inputCls} {...formik.getFieldProps('idProofType')}>
                <option value="">Select ID proof (optional)</option>
                <option value="aadhaar">Aadhaar Card</option>
                <option value="passport">Passport</option>
                <option value="driving_license">Driving License</option>
                <option value="voter_id">Voter ID Card</option>
                <option value="other">Other Photo ID</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>ID Proof Number</label>
              <input
                className={inputCls}
                placeholder="e.g. XXXX-XXXX-1234"
                {...formik.getFieldProps('idProofNo')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              Log Visitor Check-In
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Add Complaint Modal ──────────────────────────────────────────────────────
function AddComplaintModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: { category: '', description: '' },
    validationSchema: Yup.object({
      category: Yup.string().required('Select a complaint category'),
      description: Yup.string()
        .trim()
        .min(10, 'Please describe your complaint in at least 10 characters')
        .max(3000, 'Max 3000 characters')
        .required('Description is required'),
    }),
    onSubmit: async (values) => {
      const res = await mutation('hostel/complaints', {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if (res) {
        onSaved();
        onClose();
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-white p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">File Hostel Grievance / Repair Ticket</h3>
        <p className="mt-1 text-xs text-slate-500">
          Report maintenance breakdown, cleanliness issues, or mess complaints to the hostel warden
          team.
        </p>

        <form onSubmit={formik.handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className={labelCls}>Issue Category *</label>
            <select className={inputCls} {...formik.getFieldProps('category')}>
              <option value="">Select category</option>
              <option value="maintenance">
                Room Maintenance (Electrical / Plumbing / Furniture)
              </option>
              <option value="cleanliness">Hostel Hygiene & Washroom Sanitation</option>
              <option value="mess">Mess & Food Quality</option>
              <option value="security">Security & Gate Entry</option>
              <option value="other">Other Hostel Grievance</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Room rent is derived from the allocation&apos;s approved fee terms.
            </p>
            {formik.touched.category && formik.errors.category && (
              <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.category}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Detailed Description *</label>
            <textarea
              rows={3}
              className={inputCls}
              placeholder="Describe the issue, room number, or symptom in detail (at least 10 characters)..."
              {...formik.getFieldProps('description')}
            />
            {formik.touched.description && formik.errors.description && (
              <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.description}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              Submit Complaint
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Generate Fee Record Modal (Super Admin) ────────────────────────────────
function GenerateFeeModal({
  allocations,
  onClose,
  onSaved,
}: {
  allocations: IHostelAllocation[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const activeAllocs = allocations.filter((a) => a.status === 'active');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const formik = useFormik({
    initialValues: {
      allocationId: '',
      month: currentMonth,
      otherCharges: 0,
      dueDate: '',
    },
    validationSchema: Yup.object({
      allocationId: Yup.string().required('Select a student allocation'),
      month: Yup.string()
        .matches(/^\d{4}-\d{2}$/, 'YYYY-MM format')
        .required('Month selection is required'),
      otherCharges: Yup.number().min(0, 'Other charges cannot be negative'),
      dueDate: Yup.date().required('Due date is required'),
    }),
    onSubmit: async (values) => {
      const alloc = activeAllocs.find((a) => a._id === values.allocationId);
      if (!alloc) {
        toast.error('Allocation not found');
        return;
      }
      const res = await mutation('hostel/fees', {
        method: 'POST',
        body: {
          allocationId: values.allocationId,
          month: values.month,
          otherCharges: Number(values.otherCharges),
          dueDate: values.dueDate,
        },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Fee record generated');
        onSaved();
        onClose();
      } else {
        toast.error('Generation failed');
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">Generate Hostel Fee Ledger Bill</h3>
        <p className="mt-1 text-xs text-slate-500">
          Create monthly room rent, mess charges, and utility dues for an active resident.
        </p>

        <form onSubmit={formik.handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className={labelCls}>Student Room Allocation *</label>
            <select className={inputCls} {...formik.getFieldProps('allocationId')}>
              <option value="">Select resident student & room</option>
              {activeAllocs.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.studentName} — Room {a.roomNumber} ({a.academicYear})
                </option>
              ))}
            </select>
            {formik.touched.allocationId && formik.errors.allocationId && (
              <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.allocationId}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Billing Month (YYYY-MM) *</label>
              <input
                type="month"
                className={inputCls}
                value={formik.values.month}
                onChange={(e) => formik.setFieldValue('month', e.target.value)}
              />
              <p className="mt-1 text-[11px] text-slate-500">Target billing period.</p>
              {formik.touched.month && formik.errors.month && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.month}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Payment Due Date *</label>
              <input type="date" className={inputCls} {...formik.getFieldProps('dueDate')} />
              <p className="mt-1 text-[11px] text-slate-500">Deadline before late fee.</p>
              {formik.touched.dueDate && formik.errors.dueDate && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.dueDate}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Additional Charges (₹)</label>
            <input
              type="number"
              min={0}
              placeholder="e.g. 500 (Laundry / Damage repair / Miscellaneous)"
              className={inputCls}
              {...formik.getFieldProps('otherCharges')}
            />
            {formik.touched.otherCharges && formik.errors.otherCharges && (
              <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.otherCharges}</p>
            )}
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900">
            Estimated Total Dues:{' '}
            <b className="text-blue-950 font-bold text-sm">
              ₹
              {(activeAllocs.find((allocation) => allocation._id === formik.values.allocationId)
                ?.monthlyFee ?? 0) +
                (activeAllocs.find((allocation) => allocation._id === formik.values.allocationId)
                  ?.messFee ?? 0) +
                Number(formik.values.otherCharges || 0)}
            </b>
            <span className="ml-1 text-slate-600 block mt-0.5">
              Calculated automatically from room tariff + mess fee + additional charges.
            </span>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              Generate Fee Record
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Collect Payment Modal (Super Admin) ────────────────────────────────────
function CollectPaymentModal({
  row,
  onClose,
  onSaved,
}: {
  row: IHostelFeeRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const remaining = row.totalDue - row.paidAmount;
  const formik = useFormik({
    initialValues: {
      paidAmount: remaining,
      paymentMode: 'cash' as 'cash' | 'online' | 'bank_transfer' | 'upi' | 'dd' | 'cheque',
    },
    validationSchema: Yup.object({
      paidAmount: Yup.number()
        .positive('Must be > 0')
        .max(remaining, `Max payable is ₹${remaining}`)
        .required('Amount is required'),
      paymentMode: Yup.string().required('Select payment mode'),
    }),
    onSubmit: async (values) => {
      const res = await mutation(`hostel/fees/${row._id}/pay`, {
        method: 'PUT',
        body: {
          paidAmount: Number(values.paidAmount),
          paymentMode: values.paymentMode,
        },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Payment recorded');
        onSaved();
        onClose();
      } else {
        toast.error('Payment recording failed');
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="w-full max-w-md rounded-2xl bg-white p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">Record Hostel Fee Payment</h3>
        <p className="mt-1 text-xs text-slate-500">
          Billing Month: <b>{row.month}</b> · Outstanding Balance:{' '}
          <b className="text-red-600">₹{remaining}</b>
        </p>

        <form onSubmit={formik.handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className={labelCls}>Collected Payment Amount (₹) *</label>
            <input
              type="number"
              min={1}
              max={remaining}
              className={inputCls}
              {...formik.getFieldProps('paidAmount')}
            />
            {formik.touched.paidAmount && formik.errors.paidAmount && (
              <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.paidAmount}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Payment Mode *</label>
            <select className={inputCls} {...formik.getFieldProps('paymentMode')}>
              <option value="cash">Cash Payment</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="online">Online Card / NetBanking</option>
              <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
              <option value="dd">Demand Draft (DD)</option>
              <option value="cheque">Cheque</option>
            </select>
            {formik.touched.paymentMode && formik.errors.paymentMode && (
              <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.paymentMode}</p>
            )}
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900">
            The official receipt number is generated automatically and posted to Accounts.
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              Record Payment
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AllocationModal({
  rooms,
  onClose,
  onSaved,
}: {
  rooms: IHostelRoom[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const availableRooms = rooms.filter((room) => room.isActive && room.occupancy < room.capacity);
  const formik = useFormik({
    initialValues: {
      studentId: '',
      roomId: '',
      academicYear: '',
      messFee: 0,
      remarks: '',
    },
    validationSchema: Yup.object({
      studentId: Yup.string().required('Select a resident student'),
      roomId: Yup.string().required('Select an available room'),
      academicYear: Yup.string().required('Select an academic year'),
      messFee: Yup.number().min(0, 'Fee cannot be negative'),
    }),
    onSubmit: async (values) => {
      const submit = async (ignoreWarning = false) =>
        mutation('hostel/allocations', {
          method: 'POST',
          body: { ...values, messFee: Number(values.messFee), ignoreWarning },
          isAlert: true,
        });
      let response = await submit();
      const result = response as {
        results?: { success?: boolean; warning?: boolean; message?: string };
      };
      if (result.results?.warning) {
        const confirmation = await Swal.fire({
          title: 'Mixed academic-year room',
          text: result.results.message,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Allocate anyway',
          confirmButtonColor: '#0178D7',
        });
        if (!confirmation.isConfirmed) return;
        response = await submit(true);
      }
      if ((response as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Room allocated');
        onSaved();
        onClose();
      } else toast.error('Allocation could not be completed');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div className="w-full max-w-xl rounded-2xl bg-white p-6">
        <h3 className="text-lg font-bold text-slate-900">Allocate Hostel Room Bed</h3>
        <p className="mt-1 text-xs text-slate-500">
          Assign a resident student to an available room bed with mess tariff and academic year
          tracking.
        </p>

        <form onSubmit={formik.handleSubmit} className="mt-4 space-y-4">
          <AsyncSelect
            type="students"
            label="Resident Student *"
            value={formik.values.studentId || null}
            onChange={(value) => formik.setFieldValue('studentId', value ?? '')}
            placeholder="Search student by name or roll number..."
            required
          />
          {formik.touched.studentId && formik.errors.studentId && (
            <p className="text-xs font-medium text-red-500">{formik.errors.studentId}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <AsyncSelect
                type="academicYears"
                label="Academic Session Year *"
                value={formik.values.academicYear || null}
                onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
                required
              />
              {formik.touched.academicYear && formik.errors.academicYear && (
                <p className="mt-1 text-xs font-medium text-red-500">
                  {formik.errors.academicYear}
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>Available Room Location *</label>
              <select className={inputCls} {...formik.getFieldProps('roomId')}>
                <option value="">Select available room</option>
                {availableRooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.hostelName} · {room.blockName} · Room {room.roomNumber} (
                    {room.capacity - room.occupancy} bed remaining)
                  </option>
                ))}
              </select>
              {formik.touched.roomId && formik.errors.roomId && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.roomId}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Monthly Mess & Food Fee (₹)</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 3500"
                className={inputCls}
                {...formik.getFieldProps('messFee')}
              />
              <p className="mt-1 text-[11px] text-slate-500">Mess charges per month.</p>
            </div>
            <div>
              <label className={labelCls}>Allocation Remarks / Special Needs</label>
              <input
                className={inputCls}
                placeholder="e.g. Ground floor request for medical reasons"
                {...formik.getFieldProps('remarks')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              Confirm Allocation
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Room Modal (Add/Edit) ───────────────────────────────────────────────────
function RoomModal({
  onClose,
  onSaved,
  room,
}: {
  onClose: () => void;
  onSaved: () => void;
  room?: IHostelRoom | null;
}) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      hostelName: room?.hostelName ?? '',
      roomNumber: room?.roomNumber ?? '',
      blockName: room?.blockName ?? '',
      hostelType: room?.hostelType ?? 'boys',
      roomType: room?.roomType ?? 'single',
      floor: room?.floor ?? 0,
      capacity: room?.capacity ?? 1,
      monthlyFee: room?.monthlyFee ?? 0,
      facilities: room?.facilities ? room.facilities.join(', ') : '',
      isActive: room?.isActive ?? true,
    },
    validationSchema: Yup.object({
      hostelName: Yup.string()
        .trim()
        .min(2, 'Min 2 characters')
        .max(120, 'Max 120 characters')
        .required('Hostel name is required'),
      roomNumber: Yup.string()
        .trim()
        .min(1, 'Min 1 character')
        .max(30, 'Max 30 characters')
        .required('Room number is required'),
      blockName: Yup.string()
        .trim()
        .min(1, 'Min 1 character')
        .max(80, 'Max 80 characters')
        .required('Block name is required'),
      hostelType: Yup.string().oneOf(['boys', 'girls', 'mixed']).required('Select hostel type'),
      roomType: Yup.string()
        .oneOf(['single', 'double', 'triple', 'dormitory'])
        .required('Select room type'),
      floor: Yup.number()
        .min(0, 'Floor cannot be negative')
        .max(100, 'Max 100 floors')
        .required('Floor is required'),
      capacity: Yup.number()
        .min(1, 'Capacity must be at least 1')
        .max(100, 'Max 100 capacity')
        .required('Capacity is required'),
      monthlyFee: Yup.number().min(0, 'Fee cannot be negative').required('Monthly fee is required'),
    }),
    onSubmit: async (values) => {
      const data = {
        ...values,
        facilities: values.facilities
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
      };
      const path = room?._id ? `hostel/rooms/${room._id}` : 'hostel/rooms';
      const method = room?._id ? 'PUT' : 'POST';
      const res = await mutation(path, {
        method,
        body: data,
        isAlert: true,
      });
      if (res?.results?.success !== false) {
        onSaved();
        onClose();
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8  max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Building2 className="h-4.5 w-4.5" />
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {room?._id ? 'Edit Hostel Room Record' : 'Register New Hostel Room'}
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Configure room capacity, gender resident policy, monthly tariff, and amenities for
              campus room allocations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Guided Information Banner */}
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-950">
          <p className="font-semibold flex items-center gap-1.5 text-indigo-900">
            <Info className="h-4 w-4 text-indigo-600 shrink-0" />
            Field Guidance & Allocation Setup
          </p>
          <p className="mt-1 text-indigo-700 leading-relaxed">
            Every registered room automatically links with the student allotment engine. Ensure{' '}
            <strong>Monthly Rent Fee</strong> is accurate as it generates automatic student ledger
            entries upon room assignment.
          </p>
        </div>

        <form onSubmit={formik.handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Hostel / Residence Name *</label>
              <input
                className={inputCls}
                placeholder="e.g. Tagore Hostel, Sarojini Hall"
                {...formik.getFieldProps('hostelName')}
              />
              <p className="mt-1 text-[11px] text-slate-600">
                Official name of the residential building.
              </p>
              {formik.touched.hostelName && formik.errors.hostelName && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.hostelName}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Block Name / Wing *</label>
              <input
                className={inputCls}
                placeholder="e.g. Block A, East Wing"
                {...formik.getFieldProps('blockName')}
              />
              <p className="mt-1 text-[11px] text-slate-600">
                Wing or architectural section designation.
              </p>
              {formik.touched.blockName && formik.errors.blockName && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.blockName}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Room Number *</label>
              <input
                className={inputCls}
                placeholder="e.g. 102, B-304"
                {...formik.getFieldProps('roomNumber')}
              />
              <p className="mt-1 text-[11px] text-slate-600">
                Unique room identifier on the floor.
              </p>
              {formik.touched.roomNumber && formik.errors.roomNumber && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.roomNumber}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Floor Level *</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                {...formik.getFieldProps('floor')}
              />
              <p className="mt-1 text-[11px] text-slate-600">
                0 for Ground Floor, 1 for 1st Floor, etc.
              </p>
              {formik.touched.floor && formik.errors.floor && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.floor}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Hostel Resident Gender Category *</label>
              <select className={inputCls} {...formik.getFieldProps('hostelType')}>
                <option value="boys">Boys Hostel</option>
                <option value="girls">Girls Hostel</option>
                <option value="mixed">Co-ed / Mixed Hostel</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-600">
                Used by allocation engine for student gender matching.
              </p>
            </div>
            <div>
              <label className={labelCls}>Room Bed Configuration *</label>
              <select className={inputCls} {...formik.getFieldProps('roomType')}>
                <option value="single">Single Seater Room</option>
                <option value="double">Double Seater Room</option>
                <option value="triple">Triple Seater Room</option>
                <option value="dormitory">Dormitory Hall</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-600">Room layout and seating type.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Capacity (Max Beds) *</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                {...formik.getFieldProps('capacity')}
              />
              <p className="mt-1 text-[11px] text-slate-600">Maximum allowed resident students.</p>
              {formik.touched.capacity && formik.errors.capacity && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.capacity}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Monthly Rent Fee (₹) *</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                {...formik.getFieldProps('monthlyFee')}
              />
              <p className="mt-1 text-[11px] text-slate-600">Tariff per resident bed per month.</p>
              {formik.touched.monthlyFee && formik.errors.monthlyFee && (
                <p className="mt-1 text-xs font-medium text-red-500">{formik.errors.monthlyFee}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Room Amenities & Facilities</label>
            <input
              className={inputCls}
              {...formik.getFieldProps('facilities')}
              placeholder="e.g. Wi-Fi, Air Conditioner, Attached Washroom, Balcony, Study Desk"
            />
            <p className="mt-1 text-[11px] text-slate-600">
              Comma-separated list of room features shown on student portal.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label
              htmlFor="isActive"
              className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-800"
            >
              <input
                type="checkbox"
                id="isActive"
                checked={Boolean(formik.values.isActive)}
                onChange={(e) => formik.setFieldValue('isActive', e.target.checked)}
                className="h-4.5 w-4.5 rounded text-primary focus:ring-primary"
              />
              <span>Room Available for Student Allocation (Active Status)</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              {room?._id ? 'Update Room Record' : 'Register Room Record'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Reallocate Room Modal ────────────────────────────────────────────────────
function ReallocateModal({
  onClose,
  onSaved,
  allocation,
  rooms,
}: {
  onClose: () => void;
  onSaved: () => void;
  allocation: IHostelAllocation;
  rooms: IHostelRoom[];
}) {
  const { mutation, isLoading } = useMutation();
  const [selectedRoomId, setSelectedRoomId] = useState('');

  const getRoomIdString = (roomIdVal: string | IHostelRoom): string => {
    if (typeof roomIdVal === 'object' && roomIdVal !== null) {
      return roomIdVal._id;
    }
    return String(roomIdVal);
  };

  const availableRooms = rooms.filter(
    (r) => r.isActive && r.occupancy < r.capacity && r._id !== getRoomIdString(allocation.roomId),
  );

  const handleSubmit = async (e: React.FormEvent, ignoreWarning = false) => {
    e.preventDefault();
    if (!selectedRoomId) return;

    const res = (await mutation(`hostel/allocations/${allocation._id}/reallocate`, {
      method: 'PUT',
      body: { roomId: selectedRoomId, ignoreWarning },
    })) as { success?: boolean; warning?: boolean; message?: string } | undefined;

    if (res && !res.success && res.warning) {
      const confirm = await Swal.fire({
        title: 'Academic Year Mismatch',
        text: res.message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, proceed',
        cancelButtonText: 'No, cancel',
      });
      if (confirm.isConfirmed) {
        await handleSubmit(e, true);
      }
    } else if (res && res.success) {
      toast.success('Room reassigned successfully');
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6"
      >
        <h3 className="text-lg font-bold text-slate-900">
          Reassign / Transfer Student Hostel Room
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Transfer <strong>{allocation.studentName}</strong> from Current Room{' '}
          <b>{allocation.roomNumber}</b> to a new available room bed.
        </p>

        <form onSubmit={(e) => handleSubmit(e, false)} className="mt-4 space-y-4">
          <div>
            <label className={labelCls}>Select Destination Room *</label>
            <select
              className={inputCls}
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              required
            >
              <option value="">Select available room bed...</option>
              {availableRooms.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.hostelName} · Block {r.blockName} · Room {r.roomNumber} (Floor {r.floor},{' '}
                  {r.capacity - r.occupancy} bed left, ₹{r.monthlyFee}/mo)
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Only rooms with active status and vacant beds are listed.
            </p>
            {availableRooms.length === 0 && (
              <p className="mt-1 text-xs text-red-500">No other available rooms found.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <CustomButton variant="cancel" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading} disabled={!selectedRoomId}>
              Reassign Room
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function HostelOperationalAnalytics({
  rooms,
  visitors,
  complaints,
  fees,
}: {
  rooms: IHostelRoom[];
  visitors: IVisitor[];
  complaints: IComplaint[];
  fees: IHostelFeeRow[];
}) {
  const capacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
  const occupied = rooms.reduce((sum, room) => sum + room.occupancy, 0);
  const occupancyPercent = capacity ? Math.min(100, (occupied / capacity) * 100) : 0;
  const circumference = 2 * Math.PI * 42;
  const insideVisitors = visitors.filter((visitor) => !visitor.checkOut).length;
  const openComplaints = complaints.filter((complaint) =>
    ['open', 'in_progress'].includes(complaint.status),
  ).length;
  const overdueFees = fees.filter((fee) => fee.status === 'overdue').length;
  const outstandingFees = fees.reduce(
    (sum, fee) => sum + Math.max(0, fee.totalDue - fee.paidAmount),
    0,
  );
  const operationMax = Math.max(1, insideVisitors, openComplaints, overdueFees);

  if (!capacity && !visitors.length && !complaints.length && !fees.length) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Hostel operational analytics">
      {capacity > 0 && (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Residential occupancy</h2>
            <p className="mt-1 text-xs text-slate-500">Occupied beds against configured capacity</p>
          </div>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <div className="relative h-32 w-32 shrink-0">
              <svg
                viewBox="0 0 100 100"
                className="h-full w-full -rotate-90"
                role="img"
                aria-label="Hostel bed occupancy donut"
              >
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="11" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${(occupancyPercent / 100) * circumference} ${circumference}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-900">
                  {occupancyPercent.toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-500">occupied</span>
              </div>
            </div>
            <div className="w-full space-y-2 sm:max-w-56">
              {[
                ['Occupied beds', occupied, 'bg-blue-500'],
                ['Vacant beds', Math.max(0, capacity - occupied), 'bg-emerald-500'],
                [
                  'Maintenance rooms',
                  rooms.filter((room) => room.status === 'maintenance').length,
                  'bg-amber-500',
                ],
              ].map(([label, value, color]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <span className="flex items-center gap-2 text-xs text-slate-600">
                    <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    {label}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      )}
      <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Operational exposure</h2>
            <p className="mt-1 text-xs text-slate-500">
              Live visitors, unresolved complaints and overdue fee records
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-slate-900">
              ₹{outstandingFees.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-500">outstanding</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {[
            ['Visitors inside', insideVisitors, 'fill-violet-500'],
            ['Open complaints', openComplaints, 'fill-amber-500'],
            ['Overdue fees', overdueFees, 'fill-rose-500'],
          ].map(([label, value, color]) => (
            <div key={String(label)}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="font-medium text-slate-600">{label}</span>
                <span className="font-bold text-slate-900">{value}</span>
              </div>
              <svg viewBox="0 0 100 6" className="h-2 w-full" aria-hidden="true">
                <rect width="100" height="6" rx="3" className="fill-slate-100" />
                <rect
                  width={(Number(value) / operationMax) * 100}
                  height="6"
                  rx="3"
                  className={String(color)}
                />
              </svg>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function HostelPage() {
  const selectedRole = useAuthStore((state) => state.activeRole);
  const selectedSystemRole = useAuthStore((state) => state.role);
  const activeRole = selectedRole?.baseRole ?? selectedRole?.name ?? selectedSystemRole;
  const canView = useHasPermission('hostel', 'view');
  const canCreate = useHasPermission('hostel', 'create');
  const canEdit = useHasPermission('hostel', 'edit');
  const canApprove = useHasPermission('hostel', 'approve');
  const isStudent = activeRole === 'student';
  const [tab, setTab] = useState<TTab>(() => (isStudent ? 'allocations' : 'rooms'));

  const visibleTabs = useMemo(() => {
    if (isStudent) {
      return [
        {
          id: 'allocations' as TTab,
          label: 'My Allocation',
          description: 'Room and stay details',
          icon: <Users className="h-4 w-4" />,
        },
        {
          id: 'complaints' as TTab,
          label: 'My Complaints',
          description: 'Issues and resolutions',
          icon: <AlertCircle className="h-4 w-4" />,
        },
        {
          id: 'fees' as TTab,
          label: 'My Fees',
          description: 'Charges and payments',
          icon: <Receipt className="h-4 w-4" />,
        },
      ];
    }
    return [
      {
        id: 'rooms' as TTab,
        label: 'Rooms',
        description: 'Inventory and capacity',
        icon: <Building2 className="h-4 w-4" />,
      },
      {
        id: 'allocations' as TTab,
        label: 'Allocations',
        description: 'Residents and allotments',
        icon: <Users className="h-4 w-4" />,
      },
      {
        id: 'visitors' as TTab,
        label: 'Visitors',
        description: 'Gate entry and checkout',
        icon: <UserCheck className="h-4 w-4" />,
      },
      {
        id: 'complaints' as TTab,
        label: 'Operations',
        description: 'Complaints and resolution',
        icon: <AlertCircle className="h-4 w-4" />,
      },
      {
        id: 'fees' as TTab,
        label: 'Fees',
        description: 'Ledger and collections',
        icon: <Receipt className="h-4 w-4" />,
      },
    ];
  }, [isStudent]);
  const [filterStatus, setFilterStatus] = useState('');
  const [visitorModal, setVisitorModal] = useState(false);
  const [complaintModal, setComplaintModal] = useState(false);
  const [feeGenModal, setFeeGenModal] = useState(false);
  const [feePayRow, setFeePayRow] = useState<IHostelFeeRow | null>(null);
  const [roomModal, setRoomModal] = useState<IHostelRoom | null | 'new'>(null);
  const [reallocRow, setReallocRow] = useState<IHostelAllocation | null>(null);
  const [allocationModal, setAllocationModal] = useState(false);

  const {
    data: roomsRaw,
    error: roomsError,
    isLoading: roomsLoading,
    isValidating: roomsValidating,
    mutate: mutateRooms,
  } = useSwr(canView ? 'hostel/rooms' : null);
  const {
    data: allocsRaw,
    error: allocsError,
    isLoading: allocsLoading,
    isValidating: allocsValidating,
    mutate: mutateAllocs,
  } = useSwr(
    canView ? (isStudent ? 'hostel/allocations/my' : 'hostel/allocations?limit=500') : null,
  );
  const {
    data: visitorsRaw,
    isLoading: visitorsLoading,
    isValidating: visitorsValidating,
    mutate: mutateVisitors,
  } = useSwr(canView && !isStudent ? 'hostel/visitors?limit=500' : null);
  const {
    data: complaintsRaw,
    error: complaintsError,
    isLoading: complaintsLoading,
    isValidating: complaintsValidating,
    mutate: mutateComplaints,
  } = useSwr(canView ? 'hostel/complaints?limit=500' : null);
  const {
    data: feesRaw,
    error: feesError,
    isLoading: feesLoading,
    isValidating: feesValidating,
    mutate: mutateFees,
  } = useSwr(canView ? 'hostel/fees?limit=500' : null);

  const extractArray = <T,>(raw: unknown): T[] => {
    if (!raw || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data as T[];
    if (
      r.data &&
      typeof r.data === 'object' &&
      Array.isArray((r.data as Record<string, unknown>).data)
    ) {
      return (r.data as Record<string, unknown>).data as T[];
    }
    if (Array.isArray(r.results)) return r.results as T[];
    return [];
  };

  const rooms: IHostelRoom[] = extractArray<IHostelRoom>(roomsRaw).map((room) => ({
    ...room,
    status: !room.isActive ? 'maintenance' : room.occupancy >= room.capacity ? 'full' : 'available',
  }));
  const allocs = useMemo(() => {
    const staffRows = extractArray<IHostelAllocation>(allocsRaw);
    const studentRow = (allocsRaw as { data?: IHostelAllocation | null })?.data;
    const rows = isStudent
      ? studentRow && typeof studentRow === 'object' && 'studentId' in studentRow
        ? [studentRow]
        : []
      : staffRows;
    return rows.map((allocation) => {
      const student = typeof allocation.studentId === 'object' ? allocation.studentId : undefined;
      const room = typeof allocation.roomId === 'object' ? allocation.roomId : undefined;
      return {
        ...allocation,
        studentName: allocation.studentName || student?.name || 'Student',
        roomNumber: allocation.roomNumber || room?.roomNumber || '—',
        blockName: allocation.blockName || room?.blockName || '—',
        hostelType: allocation.hostelType || room?.hostelType || 'mixed',
        allotmentDate: allocation.allotmentDate || allocation.allocationDate,
      };
    });
  }, [allocsRaw, isStudent]);
  const visitors: IVisitor[] = extractArray<IVisitor>(visitorsRaw);
  const complaints: IComplaint[] = extractArray<IComplaint>(complaintsRaw).map((complaint) => ({
    ...complaint,
    studentName:
      complaint.studentName ||
      (typeof complaint.studentId === 'object' ? complaint.studentId.name : undefined) ||
      'Resident',
  }));
  const fees: IHostelFeeRow[] = extractArray<IHostelFeeRow>(feesRaw);

  const { mutation } = useMutation();

  const filteredAllocs = useMemo(() => {
    if (!filterStatus) return allocs;
    return allocs.filter((r) => r.status === filterStatus);
  }, [allocs, filterStatus]);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Hostel access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">Your active role cannot view hostel services.</p>
      </div>
    );
  }
  const pageError = roomsError ?? allocsError ?? complaintsError ?? feesError;
  if (pageError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Hostel services could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-600">{pageError.message}</p>
        <CustomButton
          className="mx-auto mt-4 w-fit!"
          onClick={() => {
            void mutateRooms();
            void mutateAllocs();
            void mutateComplaints();
            void mutateFees();
          }}
        >
          Try again
        </CustomButton>
      </div>
    );
  }

  const handleVacate = async (row: IHostelAllocation) => {
    const confirm = await Swal.fire({
      title: 'Vacate Room?',
      text: `Mark ${row.studentName} as vacated from Room ${row.roomNumber}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Vacate',
      confirmButtonColor: '#0178D7',
    });
    if (confirm.isConfirmed) {
      const res = await mutation(`hostel/allocations/${row._id}/vacate`, {
        method: 'PUT',
        isAlert: true,
      });
      if ((res as { data?: { success?: boolean } })?.data?.success !== false) {
        mutateAllocs();
      } else {
        toast.error('Vacate failed');
      }
    }
  };

  const handleCheckout = async (row: IVisitor) => {
    const confirm = await Swal.fire({
      title: 'Mark Checkout?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      confirmButtonColor: '#0178D7',
    });
    if (confirm.isConfirmed) {
      const res = await mutation(`hostel/visitors/${row._id}/checkout`, { method: 'PUT' });
      if (res) {
        toast.success('Visitor checked out');
        mutateVisitors();
      }
    }
  };

  const handleResolveComplaint = async (row: IComplaint) => {
    const prompt = await Swal.fire({
      title: 'Resolve complaint',
      input: 'textarea',
      inputLabel: 'Resolution provided',
      inputPlaceholder: 'Explain the corrective action completed',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Enter a meaningful resolution note' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Mark resolved',
      confirmButtonColor: '#0178D7',
    });
    if (!prompt.isConfirmed) return;
    const res = await mutation(`hostel/complaints/${row._id}`, {
      method: 'PUT',
      body: { status: 'resolved', resolution: prompt.value.trim() },
    });
    if (res) {
      toast.success('Complaint resolved');
      mutateComplaints();
    }
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  const FEE_STATUS_CFG: Record<
    IHostelFeeRow['status'],
    { label: string; bg: string; text: string }
  > = {
    unpaid: { label: 'Unpaid', bg: 'bg-amber-50', text: 'text-amber-600' },
    partial: { label: 'Partial', bg: 'bg-blue-50', text: 'text-blue-600' },
    paid: { label: 'Paid', bg: 'bg-secondary-50', text: 'text-secondary' },
    overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-500' },
  };

  const feeColumns: Column<IHostelFeeRow>[] = [
    {
      field: 'studentId',
      title: 'Student',
      render: (r) => {
        const s = typeof r.studentId === 'object' ? r.studentId : null;
        return (
          <div>
            <p className="text-sm font-medium text-slate-800">{s?.name ?? '—'}</p>
            <p className="text-xs text-slate-600">{s?.rollNumber ?? ''}</p>
          </div>
        );
      },
    },
    {
      field: 'month',
      title: 'Month',
      render: (r) => <span className="text-sm text-slate-700">{r.month}</span>,
    },
    {
      field: 'totalDue',
      title: 'Total Due',
      render: (r) => (
        <span className="text-sm font-semibold text-slate-800">{fmtMoney(r.totalDue)}</span>
      ),
    },
    {
      field: 'paidAmount',
      title: 'Paid',
      render: (r) => <span className="text-sm text-secondary">{fmtMoney(r.paidAmount)}</span>,
    },
    {
      field: 'dueDate',
      title: 'Due Date',
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-500">
          {new Date(r.dueDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const c = FEE_STATUS_CFG[r.status];
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>
            {c.label}
          </span>
        );
      },
    },
  ];

  const feeActions: Action<IHostelFeeRow>[] = [
    {
      tooltip: 'Collect Payment',
      icon: <Wallet className="h-4 w-4 text-secondary" />,
      onClick: (r) => setFeePayRow(r),
      hidden: (r) => !canApprove || r.status === 'paid',
    },
  ];

  const totalAvailable = rooms.filter((r) => r.status === 'available').length;
  const totalOccupied = rooms.reduce((s, r) => s + r.occupancy, 0);
  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const activeAllocs = allocs.filter((r) => r.status === 'active').length;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const roomColumns: Column<IHostelRoom>[] = [
    {
      field: 'roomNumber',
      title: 'Room',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-800">
            {row.roomNumber} — {row.blockName}
          </p>
          <p className="text-xs text-slate-600 capitalize">
            {row.hostelType} · Floor {row.floor}
          </p>
        </div>
      ),
    },
    {
      field: 'roomType',
      title: 'Type',
      render: (row) => <span className="capitalize text-sm text-slate-600">{row.roomType}</span>,
    },
    {
      field: 'occupancy',
      title: 'Occupancy',
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.occupancy} / {row.capacity}
        </span>
      ),
    },
    {
      field: 'monthlyFee',
      title: 'Monthly Fee',
      render: (row) =>
        row.monthlyFee ? (
          <span className="text-sm font-medium text-slate-700">
            ₹{row.monthlyFee.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => {
        const c = ROOM_STATUS[row.status];
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {c.label}
          </span>
        );
      },
    },
  ];

  const roomActions: Action<IHostelRoom>[] = [
    {
      tooltip: 'Edit Room',
      icon: <Edit2 className="h-4 w-4 text-primary" />,
      onClick: (row) => setRoomModal(row),
      hidden: () => !canEdit,
    },
  ];

  const allocColumns: Column<IHostelAllocation>[] = [
    {
      field: 'studentName',
      title: 'Student',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
            {row.studentName.charAt(0)}
          </div>
          <span className="text-sm font-medium text-slate-800">{row.studentName}</span>
        </div>
      ),
    },
    {
      field: 'roomNumber',
      title: 'Room',
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.roomNumber}, {row.blockName}
        </span>
      ),
    },
    {
      field: 'allotmentDate',
      title: 'Allotment Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.allotmentDate ?? row.allocationDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => {
        const c = ALLOC_STATUS[row.status];
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {c.label}
          </span>
        );
      },
    },
  ];

  const allocActions: Action<IHostelAllocation>[] = [
    {
      tooltip: 'Vacate',
      icon: <DoorOpen className="h-4 w-4 text-amber-500" />,
      onClick: handleVacate,
      hidden: (row) => row.status !== 'active' || !canEdit,
    },
    {
      tooltip: 'Reassign Room',
      icon: <RefreshCw className="h-4 w-4 text-primary" />,
      onClick: (row) => setReallocRow(row),
      hidden: (row) => row.status !== 'active' || !canEdit,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Total Rooms',
            value: rooms.length,
            icon: <Building2 className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
          {
            label: 'Available',
            value: totalAvailable,
            icon: <DoorOpen className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Total Occupancy',
            value: `${totalOccupied}/${totalCapacity}`,
            icon: <Users className="h-4.5 w-4.5" />,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Active Allocs',
            value: activeAllocs,
            icon: <Wrench className="h-4.5 w-4.5" />,
            color: 'bg-secondary-50 text-secondary',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-xl bg-white p-4"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{roomsLoading ? '—' : s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {!isStudent && (
        <HostelOperationalAnalytics
          rooms={rooms}
          visitors={visitors}
          complaints={complaints}
          fees={fees}
        />
      )}

      <div className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${
              tab === t.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                tab === t.id ? 'bg-white/15' : 'bg-slate-100'
              }`}
            >
              {t.icon}
            </span>
            <span>
              <span className="block text-xs font-bold">{t.label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${
                  tab === t.id ? 'text-white/75' : 'text-slate-400'
                }`}
              >
                {t.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {tab === 'rooms' && (
            <div className="space-y-4">
              {canCreate && (
                <div className="flex justify-end">
                  <CustomButton
                    onClick={() => setRoomModal('new')}
                    startIcon={<Plus className="h-4 w-4" />}
                  >
                    Add Room
                  </CustomButton>
                </div>
              )}
              <DataViewSwitcher<IHostelRoom>
                data={rooms}
                isLoading={roomsLoading}
                storageKey="hostel.rooms.view"
                searchPlaceholder="Search rooms…"
                searchFields={['roomNumber', 'blockName', 'hostelType', 'roomType']}
                renderCard={(r) => {
                  const occPct = r.capacity > 0 ? Math.round((r.occupancy / r.capacity) * 100) : 0;
                  const barColor =
                    occPct >= 90
                      ? 'fill-red-500'
                      : occPct >= 60
                        ? 'fill-amber-500'
                        : 'fill-green-500';
                  const statusCfg =
                    r.status === 'available'
                      ? 'bg-green-50 text-green-600'
                      : r.status === 'maintenance'
                        ? 'bg-amber-50 text-amber-600'
                        : r.status === 'full'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-slate-100 text-slate-500';
                  return (
                    <motion.div
                      whileHover={{ y: -3 }}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5  transition hover:border-indigo-200 "
                    >
                      <div>
                        {/* Top Bar with Hostel Name & Type */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                                r.hostelType === 'girls'
                                  ? 'bg-pink-50 text-pink-600'
                                  : r.hostelType === 'boys'
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'bg-indigo-50 text-indigo-600'
                              }`}
                            >
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition">
                                {r.hostelName || 'Hostel Residence'}
                              </h4>
                              <p className="text-xs font-medium text-slate-500">
                                {r.blockName} · Room {r.roomNumber} (Floor {r.floor})
                              </p>
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusCfg}`}
                          >
                            {r.status}
                          </span>
                        </div>

                        {/* Badges & Meta */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 capitalize">
                            <Users className="h-3 w-3 text-slate-600" />
                            {r.hostelType} Hostel
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 capitalize">
                            <Bed className="h-3 w-3 text-indigo-500" />
                            {r.roomType}
                          </span>
                        </div>

                        {/* Occupancy Indicator */}
                        <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-3">
                          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                            <span>Bed Occupancy</span>
                            <span className="font-bold text-slate-800">
                              {r.occupancy} / {r.capacity} beds ({r.capacity - r.occupancy} free)
                            </span>
                          </div>
                          <svg
                            viewBox="0 0 100 6"
                            className="h-2 w-full overflow-hidden rounded-full"
                            role="img"
                            aria-label={`${occPct}% occupied`}
                          >
                            <rect width="100" height="6" rx="3" className="fill-slate-200" />
                            <motion.rect
                              initial={{ width: 0 }}
                              animate={{ width: Math.min(100, occPct) }}
                              transition={{ duration: 0.55, ease: 'easeOut' }}
                              height="6"
                              rx="3"
                              className={barColor}
                            />
                          </svg>
                        </div>

                        {/* Amenities Chips */}
                        {Array.isArray(r.facilities) && r.facilities.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1">
                            {r.facilities.slice(0, 3).map((facility, idx) => (
                              <span
                                key={idx}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {facility}
                              </span>
                            ))}
                            {r.facilities.length > 3 && (
                              <span className="text-[10px] font-semibold text-slate-600">
                                +{r.facilities.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer Tariff */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <div className="text-xs text-slate-500">
                          Tariff:{' '}
                          <span className="text-sm font-extrabold text-slate-900">
                            ₹{r.monthlyFee ?? 0}
                          </span>
                          <span className="text-[10px] text-slate-600">/month</span>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setRoomModal(r)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-50 transition cursor-pointer"
                          >
                            Edit Room
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                }}
                table={
                  <CustomTable
                    title="Room inventory"
                    description="Monitor hostel blocks, room tariffs, bed capacity and maintenance availability."
                    data={rooms}
                    columns={roomColumns}
                    actions={roomActions}
                    isLoading={roomsLoading}
                    isValidating={roomsValidating}
                    onRefresh={() => void mutateRooms()}
                    options={{ search: true, export: false, pagination: true, pageSize: 10 }}
                    localization={{ toolbar: { searchPlaceholder: 'Search rooms…' } }}
                  />
                }
              />
            </div>
          )}

          {tab === 'allocations' && (
            <div className="space-y-4">
              {canCreate && (
                <div className="flex justify-end">
                  <CustomButton
                    onClick={() => setAllocationModal(true)}
                    startIcon={<UserCheck className="h-4 w-4" />}
                  >
                    Allocate Room
                  </CustomButton>
                </div>
              )}
              <DataViewSwitcher<IHostelAllocation>
                data={filteredAllocs}
                isLoading={allocsLoading}
                storageKey="hostel.allocations.view"
                searchPlaceholder="Search allocations…"
                searchFields={['studentName', 'roomNumber', 'blockName']}
                renderCard={(a) => {
                  const cfg =
                    a.status === 'active'
                      ? 'bg-green-50 text-green-600'
                      : a.status === 'vacated'
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-amber-50 text-amber-600';
                  return (
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
                          {(a.studentName ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cfg}`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{a.studentName}</p>
                        <p className="text-xs text-slate-500">
                          Room {a.roomNumber} · {a.blockName}
                        </p>
                        <p className="text-[11px] text-slate-600 capitalize">{a.hostelType}</p>
                      </div>
                      <div className="space-y-1 text-xs text-slate-500">
                        <p>
                          Allotted:{' '}
                          <span className="text-slate-700">
                            {fmtDate(a.allotmentDate ?? a.allocationDate)}
                          </span>
                        </p>
                        {a.vacatingDate && (
                          <p>
                            Vacated:{' '}
                            <span className="text-slate-700">{fmtDate(a.vacatingDate)}</span>
                          </p>
                        )}
                      </div>
                      {canEdit && a.status === 'active' && (
                        <div className="flex items-center justify-end border-t border-slate-100 pt-3 text-xs">
                          <button
                            type="button"
                            onClick={() => handleVacate(a)}
                            className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                          >
                            <DoorOpen className="h-3 w-3" /> Vacate
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                }}
                table={
                  <CustomTable
                    title={isStudent ? 'My room allocation' : 'Resident allocation register'}
                    description={
                      isStudent
                        ? 'Review your allotted room, hostel block and occupancy dates.'
                        : 'Track current residents, room assignments, allotment dates and vacancies.'
                    }
                    data={filteredAllocs}
                    columns={allocColumns}
                    actions={allocActions}
                    isLoading={allocsLoading}
                    isValidating={allocsValidating}
                    onRefresh={() => void mutateAllocs()}
                    customActions={
                      !isStudent ? (
                        <select
                          aria-label="Filter allocations by status"
                          value={filterStatus}
                          onChange={(event) => setFilterStatus(event.target.value)}
                          className="h-9 w-fit min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">All Status</option>
                          <option value="active">Active</option>
                          <option value="vacated">Vacated</option>
                          <option value="transferred">Transferred</option>
                        </select>
                      ) : undefined
                    }
                    options={{ search: true, export: false, pagination: true, pageSize: 10 }}
                    localization={{ toolbar: { searchPlaceholder: 'Search allocations…' } }}
                  />
                }
              />
            </div>
          )}

          {tab === 'visitors' && (
            <div className="space-y-4">
              {canCreate && (
                <div className="flex justify-end">
                  <CustomButton
                    onClick={() => setVisitorModal(true)}
                    startIcon={<Plus className="h-4 w-4" />}
                  >
                    Log Visitor
                  </CustomButton>
                </div>
              )}
              <DataViewSwitcher<IVisitor>
                data={visitors}
                isLoading={visitorsLoading}
                storageKey="hostel.visitors.view"
                searchPlaceholder="Search visitors…"
                searchFields={['visitorName', 'studentName', 'visitorPhone', 'purpose', 'relation']}
                renderCard={(v) => (
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
                        {(v.visitorName ?? '?').charAt(0).toUpperCase()}
                      </div>
                      {v.checkOut ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          Checked out
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                          Inside
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{v.visitorName}</p>
                      <p className="text-xs text-slate-500">
                        Visiting {v.studentName} · {v.relation}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      <p>📞 {v.visitorPhone}</p>
                      <p className="line-clamp-2">
                        Purpose: <span className="text-slate-700">{v.purpose}</span>
                      </p>
                      <p>
                        In: <span className="text-slate-700">{fmtDate(v.checkIn)}</span>
                      </p>
                      {v.checkOut && (
                        <p>
                          Out: <span className="text-slate-700">{fmtDate(v.checkOut)}</span>
                        </p>
                      )}
                    </div>
                    {canEdit && !v.checkOut && (
                      <div className="flex items-center justify-end border-t border-slate-100 pt-3 text-xs">
                        <button
                          type="button"
                          onClick={() => handleCheckout(v)}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <DoorOpen className="h-3 w-3" /> Checkout
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
                table={
                  <CustomTable<IVisitor>
                    title="Visitor register"
                    description="Monitor visitor identity, resident contact, entry purpose and checkout status."
                    data={visitors}
                    columns={[
                      {
                        field: 'visitorName',
                        title: 'Visitor',
                        render: (r) => (
                          <span className="text-sm font-medium text-slate-800">
                            {r.visitorName}
                          </span>
                        ),
                      },
                      {
                        field: 'studentName',
                        title: 'Student',
                        render: (r) => (
                          <span className="text-sm text-slate-600">{r.studentName}</span>
                        ),
                      },
                      {
                        field: 'relation',
                        title: 'Relation',
                        render: (r) => <span className="text-sm text-slate-600">{r.relation}</span>,
                      },
                      {
                        field: 'visitorPhone',
                        title: 'Contact',
                        render: (r) => (
                          <span className="text-sm text-slate-600">{r.visitorPhone}</span>
                        ),
                      },
                      {
                        field: 'purpose',
                        title: 'Purpose',
                        render: (r) => <span className="text-sm text-slate-600">{r.purpose}</span>,
                      },
                      {
                        field: 'checkIn',
                        title: 'Check-In',
                        render: (r) => (
                          <span className="text-xs text-slate-500">{fmtDate(r.checkIn)}</span>
                        ),
                      },
                      {
                        field: 'checkOut',
                        title: 'Check-Out',
                        render: (r) =>
                          r.checkOut ? (
                            <span className="text-xs text-slate-500">{fmtDate(r.checkOut)}</span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium">Still Inside</span>
                          ),
                      },
                    ]}
                    actions={[
                      {
                        tooltip: 'Checkout',
                        icon: <DoorOpen className="h-3.5 w-3.5" />,
                        onClick: handleCheckout,
                        hidden: (r) => !canEdit || !!r.checkOut,
                      },
                    ]}
                    isLoading={visitorsLoading}
                    isValidating={visitorsValidating}
                    onRefresh={() => void mutateVisitors()}
                    options={{ search: true, export: false, pagination: true, pageSize: 10 }}
                    localization={{ toolbar: { searchPlaceholder: 'Search visitors…' } }}
                  />
                }
              />
            </div>
          )}

          {tab === 'complaints' && (
            <div className="space-y-4">
              {isStudent && (
                <div className="flex justify-end">
                  <CustomButton
                    onClick={() => setComplaintModal(true)}
                    startIcon={<Plus className="h-4 w-4" />}
                  >
                    File Complaint
                  </CustomButton>
                </div>
              )}
              <DataViewSwitcher<IComplaint>
                data={complaints}
                isLoading={complaintsLoading}
                storageKey="hostel.complaints.view"
                searchPlaceholder="Search complaints…"
                searchFields={['studentName', 'category', 'description']}
                renderCard={(c) => {
                  const cfg =
                    c.status === 'resolved'
                      ? 'bg-green-50 text-green-600'
                      : c.status === 'in_progress'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-red-50 text-red-500';
                  return (
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cfg}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c.studentName}</p>
                        <p className="text-[11px] uppercase tracking-wide text-slate-600">
                          {c.category}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-3">{c.description}</p>
                      <p className="text-[11px] text-slate-600">{fmtDate(c.createdAt)}</p>
                      {canEdit && c.status !== 'resolved' && (
                        <div className="flex items-center justify-end border-t border-slate-100 pt-3 text-xs">
                          <button
                            type="button"
                            onClick={() => handleResolveComplaint(c)}
                            className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                          >
                            <CheckCircle className="h-3 w-3" /> Resolve
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                }}
                table={
                  <CustomTable<IComplaint>
                    title={isStudent ? 'My hostel complaints' : 'Hostel operations & complaints'}
                    description={
                      isStudent
                        ? 'Track the status and resolution of issues reported for your residence.'
                        : 'Review resident issues, operational categories and resolution progress.'
                    }
                    data={complaints}
                    columns={[
                      {
                        field: 'studentName',
                        title: 'Student',
                        render: (r) => (
                          <span className="text-sm font-medium text-slate-800">
                            {r.studentName}
                          </span>
                        ),
                      },
                      {
                        field: 'category',
                        title: 'Category',
                        render: (r) => <span className="text-sm text-slate-600">{r.category}</span>,
                      },
                      {
                        field: 'description',
                        title: 'Description',
                        render: (r) => (
                          <span className="text-sm text-slate-500 line-clamp-2">
                            {r.description}
                          </span>
                        ),
                      },
                      {
                        field: 'createdAt',
                        title: 'Date',
                        render: (r) => (
                          <span className="text-xs text-slate-500">{fmtDate(r.createdAt)}</span>
                        ),
                      },
                      {
                        field: 'status',
                        title: 'Status',
                        render: (r) => {
                          const cfg = {
                            open: { bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-400' },
                            in_progress: {
                              bg: 'bg-amber-50',
                              text: 'text-amber-600',
                              dot: 'bg-amber-400',
                            },
                            resolved: {
                              bg: 'bg-green-50',
                              text: 'text-green-600',
                              dot: 'bg-green-400',
                            },
                            closed: {
                              bg: 'bg-slate-100',
                              text: 'text-slate-600',
                              dot: 'bg-slate-400',
                            },
                          } as const;
                          const cc = cfg[r.status];
                          return (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cc.bg} ${cc.text}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${cc.dot}`} />
                              {r.status}
                            </span>
                          );
                        },
                      },
                    ]}
                    actions={[
                      {
                        tooltip: 'Resolve',
                        icon: <CheckCircle className="h-3.5 w-3.5" />,
                        onClick: handleResolveComplaint,
                        hidden: (r) => !canEdit || r.status === 'resolved',
                      },
                    ]}
                    isLoading={complaintsLoading}
                    isValidating={complaintsValidating}
                    onRefresh={() => void mutateComplaints()}
                    options={{ search: true, export: false, pagination: true, pageSize: 10 }}
                    localization={{ toolbar: { searchPlaceholder: 'Search complaints…' } }}
                  />
                }
              />
            </div>
          )}

          {tab === 'fees' && (
            <div className="space-y-4">
              {canCreate && (
                <div className="flex justify-end">
                  <CustomButton
                    onClick={() => setFeeGenModal(true)}
                    startIcon={<Plus className="h-4 w-4" />}
                  >
                    Generate Fee Record
                  </CustomButton>
                </div>
              )}
              <DataViewSwitcher<IHostelFeeRow>
                data={fees}
                isLoading={feesLoading}
                storageKey="hostel.fees.view"
                searchPlaceholder={isStudent ? 'Search my fees…' : 'Search fees…'}
                searchFields={['academicYear', 'month', 'status']}
                renderCard={(f) => {
                  const stu = typeof f.studentId === 'object' ? f.studentId : null;
                  const alloc = typeof f.allocationId === 'object' ? f.allocationId : null;
                  const balance = (f.totalDue ?? 0) - (f.paidAmount ?? 0);
                  const cfg =
                    f.status === 'paid'
                      ? 'bg-green-50 text-green-600'
                      : f.status === 'partial'
                        ? 'bg-amber-50 text-amber-600'
                        : f.status === 'overdue'
                          ? 'bg-red-50 text-red-500'
                          : 'bg-slate-100 text-slate-500';
                  return (
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cfg}`}
                        >
                          {f.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {stu?.name ?? 'Student'}
                        </p>
                        {stu?.rollNumber && (
                          <p className="text-[11px] font-mono text-slate-600">{stu.rollNumber}</p>
                        )}
                        {alloc?.roomNumber && (
                          <p className="text-xs text-slate-500">Room {alloc.roomNumber}</p>
                        )}
                        <p className="text-[11px] text-slate-600">
                          {f.month} · AY {f.academicYear}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                          <p className="text-[9px] uppercase text-slate-600">Due</p>
                          <p className="font-bold text-slate-800">₹{f.totalDue}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                          <p className="text-[9px] uppercase text-slate-600">Paid</p>
                          <p className="font-bold text-green-600">₹{f.paidAmount}</p>
                        </div>
                        <div
                          className={`rounded-lg px-2 py-1.5 ${balance > 0 ? 'bg-red-50' : 'bg-slate-50'}`}
                        >
                          <p className="text-[9px] uppercase text-slate-600">Balance</p>
                          <p
                            className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-slate-800'}`}
                          >
                            ₹{balance}
                          </p>
                        </div>
                      </div>
                      {f.dueDate && (
                        <p className="text-[11px] text-slate-500">Due {fmtDate(f.dueDate)}</p>
                      )}
                      {canApprove && f.status !== 'paid' && (
                        <div className="flex items-center justify-end border-t border-slate-100 pt-3 text-xs">
                          <button
                            type="button"
                            onClick={() => setFeePayRow(f)}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <Wallet className="h-3 w-3" /> Collect
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                }}
                table={
                  <CustomTable<IHostelFeeRow>
                    title={isStudent ? 'My hostel fees' : 'Hostel fee ledger'}
                    description={
                      isStudent
                        ? 'Review monthly hostel charges, paid amounts, balances and due dates.'
                        : 'Monitor resident charges, collections, outstanding balances and overdue fees.'
                    }
                    data={fees}
                    columns={feeColumns}
                    actions={feeActions}
                    isLoading={feesLoading}
                    isValidating={feesValidating}
                    onRefresh={() => void mutateFees()}
                    options={{ search: true, export: false, pagination: true, pageSize: 10 }}
                    localization={{
                      toolbar: {
                        searchPlaceholder: isStudent ? 'Search my fees…' : 'Search fees…',
                      },
                    }}
                  />
                }
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {visitorModal && (
          <AddVisitorModal onClose={() => setVisitorModal(false)} onSaved={mutateVisitors} />
        )}
        {complaintModal && (
          <AddComplaintModal onClose={() => setComplaintModal(false)} onSaved={mutateComplaints} />
        )}
        {feeGenModal && (
          <GenerateFeeModal
            allocations={allocs}
            onClose={() => setFeeGenModal(false)}
            onSaved={mutateFees}
          />
        )}
        {feePayRow && (
          <CollectPaymentModal
            row={feePayRow}
            onClose={() => setFeePayRow(null)}
            onSaved={mutateFees}
          />
        )}
        {allocationModal && (
          <AllocationModal
            rooms={rooms}
            onClose={() => setAllocationModal(false)}
            onSaved={() => {
              mutateAllocs();
              mutateRooms();
            }}
          />
        )}
        {roomModal && (
          <RoomModal
            room={roomModal !== 'new' ? roomModal : null}
            onClose={() => setRoomModal(null)}
            onSaved={mutateRooms}
          />
        )}
        {reallocRow && (
          <ReallocateModal
            allocation={reallocRow}
            rooms={rooms}
            onClose={() => setReallocRow(null)}
            onSaved={mutateAllocs}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default UseProtectedRoutes(HostelPage, [
  'super_admin',
  'admin',
  'principal',
  'hostel_warden',
  'warden',
  'student',
]);

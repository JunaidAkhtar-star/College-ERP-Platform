/**
 * @file ScheduleSessionModal.tsx
 * @description Modal form to schedule a new counseling session.
 * @module features/role-wise-features/counseling
 */
'use client';

import React from 'react';
import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { X, Calendar, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useMutation from '@/shared/hooks/useMutation';
import { ICreateSessionDto } from '../types/counseling.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const selectCls = inputCls;

const schema = Yup.object({
  studentId: Yup.string().required('Choose a student'),
  type: Yup.string().required('Session type is required'),
  scheduledAt: Yup.string().required('Date & time is required'),
  mode: Yup.string().required('Mode is required'),
  issueDescription: Yup.string()
    .min(10, 'Min 10 characters')
    .required('Issue description is required'),
  academicYear: Yup.string().required('Academic year is required'),
});

export default function ScheduleSessionModal({ open, onClose, onCreated }: Props) {
  const { mutation, isLoading } = useMutation();

  const formik = useFormik<ICreateSessionDto & { studentId: string }>({
    initialValues: {
      studentId: '',
      type: 'academic',
      scheduledAt: '',
      mode: 'in_person',
      issueDescription: '',
      academicYear: '',
      semester: undefined,
      venue: '',
    },
    validationSchema: schema,
    onSubmit: async (values, { resetForm }) => {
      const res = await mutation('counseling/sessions', {
        method: 'POST',
        body: { ...values, semester: values.semester || undefined },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Session scheduled successfully');
        resetForm();
        onCreated();
        onClose();
      } else {
        toast.error('Failed to schedule session');
      }
    },
  });

  const f = formik;

  return (
    <AnimatePresence>
      {open && (
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
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 "
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Schedule Counseling Session
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={f.handleSubmit} className="space-y-4">
              <div>
                <AsyncSelect
                  type="students"
                  label="Student"
                  required
                  value={f.values.studentId || null}
                  onChange={(value) => f.setFieldValue('studentId', value ?? '')}
                  placeholder="Search by name or roll number"
                />
                {f.touched.studentId && f.errors.studentId && (
                  <p className="mt-1 text-xs text-red-500">{f.errors.studentId}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Session Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={f.values.type}
                    onChange={f.handleChange}
                    className={selectCls}
                  >
                    <option value="academic">Academic</option>
                    <option value="personal">Personal</option>
                    <option value="career">Career</option>
                    <option value="disciplinary">Disciplinary</option>
                    <option value="medical">Medical</option>
                    <option value="financial">Financial</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="mode"
                    value={f.values.mode}
                    onChange={f.handleChange}
                    className={selectCls}
                  >
                    <option value="in_person">In Person</option>
                    <option value="online">Online</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={f.values.scheduledAt}
                  onChange={f.handleChange}
                  onBlur={f.handleBlur}
                  min={new Date().toISOString().slice(0, 16)}
                  className={inputCls}
                />
                {f.touched.scheduledAt && f.errors.scheduledAt && (
                  <p className="mt-1 text-xs text-red-500">{f.errors.scheduledAt}</p>
                )}
              </div>

              {f.values.mode === 'in_person' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Venue</label>
                  <input
                    name="venue"
                    value={f.values.venue ?? ''}
                    onChange={f.handleChange}
                    placeholder="Room / office"
                    className={inputCls}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <AsyncSelect
                    type="academicYears"
                    label="Academic year"
                    required
                    value={f.values.academicYear || null}
                    onChange={(value) => f.setFieldValue('academicYear', value ?? '')}
                    placeholder="Choose academic year"
                  />
                  {f.touched.academicYear && f.errors.academicYear && (
                    <p className="mt-1 text-xs text-red-500">{f.errors.academicYear}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Semester</label>
                  <select
                    name="semester"
                    value={f.values.semester ?? ''}
                    onChange={(event) =>
                      f.setFieldValue(
                        'semester',
                        event.target.value ? Number(event.target.value) : undefined,
                      )
                    }
                    className={selectCls}
                  >
                    <option value="">Not applicable</option>
                    {Array.from({ length: 8 }, (_, index) => index + 1).map((semester) => (
                      <option key={semester} value={semester}>
                        Semester {semester}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Issue Description <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
                  <textarea
                    name="issueDescription"
                    value={f.values.issueDescription}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    rows={3}
                    placeholder="Describe the issue or reason for counseling..."
                    className={inputCls + ' pl-9 resize-none'}
                  />
                </div>
                {f.touched.issueDescription && f.errors.issueDescription && (
                  <p className="mt-1 text-xs text-red-500">{f.errors.issueDescription}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <CustomButton variant="tertiary" type="button" onClick={onClose}>
                  Cancel
                </CustomButton>
                <CustomButton variant="primary" type="submit" loading={isLoading}>
                  Schedule Session
                </CustomButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

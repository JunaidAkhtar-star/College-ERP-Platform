'use client';

import { useFormik } from 'formik';
import * as Yup from 'yup';
import CustomButton from './CustomButton';

export interface IWorkflowStatusOption {
  value: string;
  label: string;
}

interface IProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  reasonLabel?: string;
  showReason?: boolean;
  statusLabel?: string;
  statusOptions?: IWorkflowStatusOption[];
  initialStatus?: string;
  resolutionStatuses?: string[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (values: { status?: string; reason: string; resolution?: string }) => Promise<void>;
}

export default function WorkflowActionDialog({
  open,
  title,
  description,
  confirmLabel,
  reasonLabel = 'Reason',
  showReason = true,
  statusLabel = 'New status',
  statusOptions = [],
  initialStatus = '',
  resolutionStatuses = [],
  loading,
  onClose,
  onConfirm,
}: IProps) {
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: { status: initialStatus, reason: '', resolution: '' },
    validationSchema: Yup.object({
      status: statusOptions.length
        ? Yup.string()
            .oneOf(statusOptions.map((option) => option.value))
            .required('Select a status')
        : Yup.string().optional(),
      reason: showReason
        ? Yup.string()
            .trim()
            .min(10, 'Enter at least 10 characters')
            .max(2000)
            .required('Reason is required')
        : Yup.string().optional(),
      resolution: Yup.string().when('status', {
        is: (status: string) => resolutionStatuses.includes(status),
        then: (schema) =>
          schema
            .trim()
            .min(10, 'Enter at least 10 characters')
            .max(5000)
            .required('Resolution is required'),
        otherwise: (schema) => schema.optional(),
      }),
    }),
    onSubmit: async (values) => {
      await onConfirm({
        status: values.status || undefined,
        reason: values.reason.trim(),
        resolution: values.resolution.trim() || undefined,
      });
    },
  });
  if (!open) return null;
  const needsResolution = resolutionStatuses.includes(formik.values.status);
  const field =
    'w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/30';
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-100/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={formik.handleSubmit}
        className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {statusOptions.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {statusLabel} *
            </label>
            <select
              name="status"
              value={formik.values.status}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={field}
            >
              <option value="">Select status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formik.touched.status && formik.errors.status && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.status}</p>
            )}
          </div>
        )}
        {showReason && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {reasonLabel} *
            </label>
            <textarea
              name="reason"
              rows={4}
              value={formik.values.reason}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={field}
              placeholder="Record a clear, auditable reason"
            />
            {formik.touched.reason && formik.errors.reason && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.reason}</p>
            )}
          </div>
        )}
        {needsResolution && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Resolution *</label>
            <textarea
              name="resolution"
              rows={4}
              value={formik.values.resolution}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={field}
              placeholder="Describe the final outcome"
            />
            {formik.touched.resolution && formik.errors.resolution && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.resolution}</p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <CustomButton type="button" variant="tertiary" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton type="submit" variant="primary" loading={loading}>
            {confirmLabel}
          </CustomButton>
        </div>
      </form>
    </div>
  );
}

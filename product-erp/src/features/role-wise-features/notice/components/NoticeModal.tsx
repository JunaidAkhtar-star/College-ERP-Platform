/**
 * @file NoticeModal.tsx
 * @description Create/edit notice — all backend fields:
 * title, content, noticeType, priority, targetRoles, targetDepartments,
 * targetPrograms, expiryDate, attachments.
 * @module features/role-wise-features/notice
 */
'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import { Bell, X } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { toast } from 'react-toastify';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';

interface IAttachment {
  fileName: string;
  fileUrl: string;
  fileSize: number;
}

interface INotice {
  _id?: string;
  title?: string;
  content?: string;
  noticeType?: string;
  targetRoles?: string[];
  targetDepartments?: string[];
  targetPrograms?: string[];
  priority?: string;
  expiryDate?: string;
  isPublished?: boolean;
  attachments?: IAttachment[];
  [key: string]: unknown;
}

interface Props {
  notice?: INotice | null;
  onClose: () => void;
  onSaved: () => void;
}

const ALL_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'principal', label: 'Principal' },
  { value: 'dean_academic', label: 'Dean Academic' },
  { value: 'hod', label: 'Head of Dept' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'examination_cell', label: 'Exam Cell' },
  { value: 'accounts_department', label: 'Accounts' },
  { value: 'hr_department', label: 'HR' },
  { value: 'library_staff', label: 'Library' },
  { value: 'placement_cell', label: 'Placement' },
  { value: 'admission_counselor', label: 'Admission' },
];

const inputCls =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const schema = Yup.object({
  title: Yup.string().trim().required('Title is required'),
  content: Yup.string().trim().required('Content is required'),
  noticeType: Yup.string().required('Type is required'),
  priority: Yup.string().required('Priority is required'),
  expiryDate: Yup.string().nullable(),
});

export default function NoticeModal({ notice, onClose, onSaved }: Props) {
  const { mutation, isLoading: saving } = useMutation();
  const [attachments, setAttachments] = useState<IViewerFile[]>(
    (notice?.attachments ?? []).map((item) => ({
      name: item.fileName,
      url: item.fileUrl,
    })),
  );
  const { data: metadata } = useSwr<{
    data?: {
      departments: { _id: string; name: string; code: string }[];
      programs: string[];
    };
  }>('communication-hub/metadata');

  const formik = useFormik({
    initialValues: {
      title: notice?.title ?? '',
      content: notice?.content ?? '',
      noticeType: notice?.noticeType ?? 'global',
      priority: notice?.priority ?? 'normal',
      expiryDate: notice?.expiryDate ? notice.expiryDate.slice(0, 10) : '',
      targetRoles: notice?.targetRoles ?? ([] as string[]),
      targetDepartments: notice?.targetDepartments ?? ([] as string[]),
      targetPrograms: notice?.targetPrograms ?? ([] as string[]),
    },
    enableReinitialize: true,
    validationSchema: schema,
    onSubmit: async (values) => {
      const body: Record<string, unknown> = {
        title: values.title,
        content: values.content,
        noticeType: values.noticeType,
        priority: values.priority,
      };
      if (values.expiryDate) body.expiryDate = values.expiryDate;
      if (values.targetRoles.length) body.targetRoles = values.targetRoles;
      if (values.targetDepartments.length) body.targetDepartments = values.targetDepartments;
      if (values.targetPrograms.length) body.targetPrograms = values.targetPrograms;
      if (attachments.length)
        body.attachments = attachments.map((item) => ({
          fileName: item.name,
          fileUrl: item.url,
          fileSize: 0,
        }));

      const isEdit = !!notice?._id;
      const res = await mutation(isEdit ? `notice/${notice!._id}` : 'notice', {
        method: isEdit ? 'PUT' : 'POST',
        body,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(isEdit ? 'Notice updated' : 'Notice created');
        onSaved();
      } else toast.error('Failed to save notice');
    },
  });

  const toggleRole = (role: string) => {
    const current = formik.values.targetRoles;
    formik.setFieldValue(
      'targetRoles',
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    );
  };

  const noticeType = formik.values.noticeType;

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
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <Bell className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Guided publishing workflow
            </p>
            <h2 className="text-lg font-black text-slate-950">
              {notice?._id ? 'Edit Notice' : 'Create Notice'}
            </h2>
            <p className="text-xs text-slate-600">
              {notice?._id
                ? 'Update the audience, message and delivery details before approval.'
                : 'Prepare a clear audience-targeted notice for independent review and publishing.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={formik.handleSubmit} className="space-y-5 p-6">
          {/* Title */}
          <div>
            <label className={labelCls}>Title *</label>
            <input
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="Notice title…"
              className={inputCls}
            />
            {formik.touched.title && formik.errors.title && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.title}</p>
            )}
          </div>

          {/* Content */}
          <div>
            <label className={labelCls}>Content *</label>
            <textarea
              name="content"
              value={formik.values.content}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              rows={5}
              placeholder="Write the notice content here…"
              className={inputCls + ' resize-none leading-relaxed'}
            />
            {formik.touched.content && formik.errors.content && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.content}</p>
            )}
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Notice Type *</label>
              <select
                name="noticeType"
                value={formik.values.noticeType}
                onChange={formik.handleChange}
                className={inputCls}
              >
                <option value="global">Global (All Users)</option>
                <option value="department">Department</option>
                <option value="role_based">Role Based</option>
                <option value="program">Program</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority *</label>
              <select
                name="priority"
                value={formik.values.priority}
                onChange={formik.handleChange}
                className={inputCls}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Target Roles (role_based) */}
          <AnimatePresence>
            {noticeType === 'role_based' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <label className={labelCls}>Target Roles</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRole(r.value)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        formik.values.targetRoles.includes(r.value)
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {formik.values.targetRoles.length === 0 && (
                  <p className="mt-1.5 text-xs text-slate-600">
                    No roles selected — notice will target no one
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Target Departments (department) */}
          <AnimatePresence>
            {noticeType === 'department' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <label className={labelCls}>Target departments</label>
                <div className="flex flex-wrap gap-2">
                  {(metadata?.data?.departments ?? []).map((department) => {
                    const selected = formik.values.targetDepartments.includes(department._id);
                    return (
                      <button
                        type="button"
                        key={department._id}
                        onClick={() =>
                          formik.setFieldValue(
                            'targetDepartments',
                            selected
                              ? formik.values.targetDepartments.filter(
                                  (value) => value !== department._id,
                                )
                              : [...formik.values.targetDepartments, department._id],
                          )
                        }
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          selected
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {department.name} ({department.code})
                      </button>
                    );
                  })}
                </div>
                {!metadata?.data?.departments?.length && (
                  <p className="text-xs text-slate-600">No active departments are available.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Target Programs (program) */}
          <AnimatePresence>
            {noticeType === 'program' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <label className={labelCls}>Target programs</label>
                <div className="flex flex-wrap gap-2">
                  {(metadata?.data?.programs ?? []).map((program) => {
                    const selected = formik.values.targetPrograms.includes(program);
                    return (
                      <button
                        type="button"
                        key={program}
                        onClick={() =>
                          formik.setFieldValue(
                            'targetPrograms',
                            selected
                              ? formik.values.targetPrograms.filter((value) => value !== program)
                              : [...formik.values.targetPrograms, program],
                          )
                        }
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          selected
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {program}
                      </button>
                    );
                  })}
                </div>
                {!metadata?.data?.programs?.length && (
                  <p className="text-xs text-slate-600">No active programs are available.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expiry Date */}
          <div>
            <label className={labelCls}>
              Expiry Date <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="date"
              name="expiryDate"
              value={formik.values.expiryDate}
              onChange={formik.handleChange}
              min={new Date().toISOString().split('T')[0]}
              className={inputCls}
            />
          </div>

          {/* Summary preview */}
          <InlineFileUpload
            label="Supporting documents"
            files={attachments}
            multiple
            onRemove={async (file) =>
              setAttachments((current) => current.filter((item) => item.url !== file.url))
            }
            onUpload={async (file) => {
              const body = new FormData();
              body.append('file', file);
              const response = await mutation('upload', {
                method: 'POST',
                body,
                isFormData: true,
                dedupe: false,
              });
              const uploaded = response?.results?.data as
                | { url?: string; filename?: string }
                | undefined;
              if (!uploaded?.url) return false;
              setAttachments((current) => [
                ...current,
                { url: uploaded.url!, name: uploaded.filename ?? file.name },
              ]);
              return true;
            }}
          />

          {/* Summary preview */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Preview
            </p>
            <p className="text-xs text-slate-600">
              This notice will be sent as{' '}
              <strong className="text-slate-800">
                {formik.values.noticeType === 'global'
                  ? 'a global notice to all users'
                  : formik.values.noticeType === 'department'
                    ? 'a department-specific notice'
                    : formik.values.noticeType === 'role_based'
                      ? `a notice to ${formik.values.targetRoles.length} role(s)`
                      : 'a program-specific notice'}
              </strong>{' '}
              with <strong className="text-slate-800">{formik.values.priority}</strong> priority.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={saving}>
              {notice?._id ? 'Update Notice' : 'Create Notice'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

'use client';

import CustomButton from '@/shared/core/CustomButton';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';
import useMutation from '@/shared/hooks/useMutation';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { Field, Form, Formik } from 'formik';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useState } from 'react';
import * as Yup from 'yup';
import type {
  IComplianceRequirement,
  IComplianceSubmission,
  TComplianceStatus,
} from '../types/compliance.types';

interface IProps {
  open: boolean;
  requirement: IComplianceRequirement | null;
  submission?: IComplianceSubmission | null;
  academicYear: string;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface IFormValues {
  period: string;
  remarks: string;
  status: TComplianceStatus;
  values: Record<string, string | number | boolean>;
}

export default function ComplianceRecordModal({
  open,
  requirement,
  submission,
  academicYear,
  readOnly = false,
  onClose,
  onSaved,
}: IProps) {
  const { mutation, isLoading } = useMutation();
  const [evidenceFiles, setEvidenceFiles] = useState<IViewerFile[]>(
    submission?.evidenceFiles ?? [],
  );
  if (!requirement) return null;

  const fieldShape = Object.fromEntries(
    requirement.requiredFields.map((item) => {
      let validator: Yup.Schema = item.type === 'number' ? Yup.number().min(0) : Yup.string();
      if (item.type === 'boolean') validator = Yup.boolean();
      if (item.required) validator = validator.required(`${item.label} is required`);
      return [item.key, validator];
    }),
  );
  const schema = Yup.object({
    period: Yup.string(),
    remarks: Yup.string().max(1000),
    values: Yup.object(fieldShape),
  });

  const initialValues: IFormValues = {
    period: submission?.period ?? '',
    remarks: submission?.remarks ?? '',
    status: submission?.status ?? 'in_progress',
    values: Object.fromEntries(
      requirement.requiredFields.map((field) => [
        field.key,
        submission?.values[field.key] ?? (field.type === 'boolean' ? false : ''),
      ]),
    ),
  };

  const save = async (form: IFormValues) => {
    const path = submission
      ? `compliance-workspace/submissions/${submission._id}`
      : 'compliance-workspace/submissions';
    const response = await mutation(path, {
      method: submission ? 'PUT' : 'POST',
      body: {
        ...form,
        requirementId: requirement._id,
        academicYear,
        evidenceFiles: evidenceFiles.map((file) => ({ url: file.url, name: file.name })),
      },
    });
    if (!response?.results?.success) {
      toast.error('Unable to save the compliance record');
      return;
    }
    toast.success(form.status === 'submitted' ? 'Record submitted for review' : 'Draft saved');
    onSaved();
    onClose();
  };

  const uploadEvidence = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: formData,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as
      | { url?: string; filename?: string; publicId?: string }
      | undefined;
    if (!uploaded?.url) return false;
    setEvidenceFiles((current) => [
      ...current,
      { url: uploaded.url!, name: uploaded.filename ?? file.name, publicId: uploaded.publicId },
    ]);
    return true;
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {requirement.code} · {requirement.category}
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{requirement.title}</h2>
                {requirement.description && (
                  <p className="mt-1 text-sm text-slate-500">{requirement.description}</p>
                )}
              </div>
              <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <Formik initialValues={initialValues} validationSchema={schema} onSubmit={save}>
              {({ errors, touched, setFieldValue, values }) => (
                <Form className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {requirement.requiredFields.map((item) => (
                      <label
                        key={item.key}
                        className="space-y-1.5 text-sm font-semibold text-slate-700"
                      >
                        <span>
                          {item.label} {item.required && <span className="text-red-500">*</span>}
                        </span>
                        {item.type === 'boolean' ? (
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() =>
                              setFieldValue(`values.${item.key}`, !values.values[item.key])
                            }
                            className={`w-full rounded-xl px-4 py-3 text-left text-sm ${values.values[item.key] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                          >
                            {values.values[item.key] ? 'Compliant / Yes' : 'Not confirmed / No'}
                          </button>
                        ) : (
                          <Field
                            name={`values.${item.key}`}
                            type={item.type}
                            disabled={readOnly}
                            className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none transition focus:bg-blue-50"
                          />
                        )}
                        {touched.values && errors.values && (
                          <span className="text-xs font-normal text-red-500">
                            {(errors.values as Record<string, string>)[item.key]}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                      <span>Reporting period</span>
                      <Field
                        name="period"
                        disabled={readOnly}
                        placeholder="e.g. Semester 1 / Q2"
                        className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                      />
                    </label>
                    {!readOnly && (
                      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                        <span>Workflow status</span>
                        <Field
                          as="select"
                          name="status"
                          className="w-full rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                        >
                          <option value="in_progress">Save as draft</option>
                          <option value="submitted">Submit for review</option>
                        </Field>
                      </label>
                    )}
                  </div>
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    <span>Remarks</span>
                    <Field
                      as="textarea"
                      rows={3}
                      name="remarks"
                      disabled={readOnly}
                      className="w-full resize-none rounded-xl bg-slate-100 px-4 py-3 font-normal outline-none"
                    />
                  </label>
                  {!readOnly && (
                    <InlineFileUpload
                      label="Supporting evidence"
                      hint="Attach approval letters, calculations or signed forms"
                      multiple
                      files={evidenceFiles}
                      onUpload={uploadEvidence}
                      onRemove={async (_file, index) =>
                        setEvidenceFiles((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                    />
                  )}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    {!readOnly && (
                      <CustomButton variant="primary" type="submit" loading={isLoading}>
                        Save record
                      </CustomButton>
                    )}
                  </div>
                </Form>
              )}
            </Formik>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

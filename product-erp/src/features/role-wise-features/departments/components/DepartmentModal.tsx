'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import { X } from 'lucide-react';
import * as Yup from 'yup';
import type { IDepartment } from '../types/departments.types';

const schema = Yup.object({
  code: Yup.string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(10, 'Code cannot exceed 10 characters')
    .required('Department code is required'),
  name: Yup.string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .required('Department name is required'),
  shortName: Yup.string()
    .trim()
    .min(2, 'Short name must be at least 2 characters')
    .required('Short name is required'),
  hodName: Yup.string().optional(),
  intake: Yup.number()
    .typeError('Intake capacity must be a valid number')
    .positive('Intake must be greater than 0')
    .integer('Intake must be a whole number')
    .required('Annual intake capacity is required'),
  status: Yup.string().oneOf(['Active', 'Inactive']).required('Status is required'),
  email: Yup.string().email('Must be a valid email address').optional(),
  phone: Yup.string().optional(),
  location: Yup.string().optional(),
  establishedYear: Yup.number()
    .typeError('Year must be a number')
    .min(1800, 'Established year must be after 1800')
    .max(new Date().getFullYear(), `Year cannot exceed ${new Date().getFullYear()}`)
    .optional(),
  naacCode: Yup.string().optional(),
  aicteCode: Yup.string().optional(),
  vision: Yup.string().optional(),
  mission: Yup.string().optional(),
  curriculumIds: Yup.array()
    .of(Yup.string())
    .min(1, 'Select at least one curriculum scheme')
    .required('Curriculum selection is required'),
});

const fc =
  'w-full rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 border border-slate-200 focus:ring-primary/20 transition-all';

function FE({ name }: { name: string }) {
  return (
    <ErrorMessage name={name}>
      {(m) => (
        <p className="mt-1 text-xs font-medium text-red-500 flex items-center gap-1">
          <span>⚠</span> {m}
        </p>
      )}
    </ErrorMessage>
  );
}

interface IProps {
  open: boolean;
  editing: IDepartment | null;
  saving: boolean;
  onClose: () => void;
  onSave: (v: Partial<IDepartment>) => Promise<void>;
}

export default function DepartmentModal({ open, editing, saving, onClose, onSave }: IProps) {
  const initial = {
    code: editing?.code ?? '',
    name: editing?.name ?? '',
    shortName: editing?.shortName ?? '',
    hodName: editing?.hodName ?? '',
    intake: editing?.intake ?? 60,
    status: editing?.status ?? 'Active',
    email: editing?.email ?? '',
    phone: editing?.phone ?? '',
    location: editing?.location ?? '',
    establishedYear: editing?.establishedYear ?? new Date().getFullYear(),
    naacCode: editing?.naacCode ?? '',
    aicteCode: editing?.aicteCode ?? '',
    vision: editing?.vision ?? '',
    mission: editing?.mission ?? '',
    curriculumIds: (editing?.curriculumIds ?? []).map((c) => (typeof c === 'string' ? c : c._id)),
  };

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
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-4xl rounded-2xl bg-white max-h-[90dvh] flex flex-col p-6 md:p-8 "
          >
            <div className="flex shrink-0 items-center justify-between pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editing ? 'Edit Department' : 'Add New Department'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing
                    ? `Update academic details for ${editing.name}`
                    : 'Configure operational, accreditation, and curriculum details for a department.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Formik
              initialValues={initial}
              enableReinitialize
              validationSchema={schema}
              onSubmit={onSave}
            >
              {({ values, setFieldValue }) => (
                <Form className="flex flex-col overflow-hidden flex-1 space-y-6 pt-3">
                  <div className="overflow-y-auto flex-1 pr-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Department Code <span className="text-red-500">*</span>
                        </label>
                        <Field name="code" placeholder="e.g. CSE" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Short unique code (e.g. CSE, ECE).
                        </p>
                        <FE name="code" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Department Name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="name"
                          placeholder="e.g. Computer Science & Engineering"
                          className={fc}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Full official name of the department.
                        </p>
                        <FE name="name" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Short Display Name <span className="text-red-500">*</span>
                        </label>
                        <Field name="shortName" placeholder="e.g. Dept. of CSE" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Abbreviated title used in header tags.
                        </p>
                        <FE name="shortName" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Head of Department (HoD)
                        </label>
                        <Field name="hodName" placeholder="e.g. Dr. Jane Doe" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Name of assigned departmental head.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Annual Student Intake <span className="text-red-500">*</span>
                        </label>
                        <Field name="intake" type="number" placeholder="60" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Maximum annual student admissions.
                        </p>
                        <FE name="intake" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Established Year
                        </label>
                        <Field
                          name="establishedYear"
                          type="number"
                          placeholder="2000"
                          className={fc}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Year department was founded.
                        </p>
                        <FE name="establishedYear" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Status <span className="text-red-500">*</span>
                        </label>
                        <Field as="select" name="status" className={fc}>
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </Field>
                        <p className="mt-1 text-[11px] text-slate-500">Operational active state.</p>
                        <FE name="status" />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Curricula Offered <span className="text-red-500">*</span>
                      </label>
                      <AsyncSelect
                        type="curricula"
                        multiple
                        value={(values.curriculumIds as string[]) ?? []}
                        onChange={(v) => setFieldValue('curriculumIds', v)}
                        placeholder="Select regulation schemes associated with this department…"
                        required
                      />
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        Select one or multiple regulation schemes linked to this department.
                      </p>
                      <FE name="curriculumIds" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Department Email
                        </label>
                        <Field
                          name="email"
                          type="email"
                          placeholder="e.g. cse@institution.edu"
                          className={fc}
                        />
                        <FE name="email" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Contact Phone
                        </label>
                        <Field name="phone" placeholder="+91 XXXXX XXXXX" className={fc} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Office Location / Building
                        </label>
                        <Field name="location" placeholder="e.g. Block A, Floor 2" className={fc} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          NAAC Reference Code
                        </label>
                        <Field name="naacCode" placeholder="e.g. NAAC-DEP-01" className={fc} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          AICTE Reference Code
                        </label>
                        <Field name="aicteCode" placeholder="e.g. 1-10928371" className={fc} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Department Vision
                        </label>
                        <Field
                          as="textarea"
                          name="vision"
                          rows={3}
                          placeholder="Enter long-term vision statement..."
                          className={fc}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Department Mission
                        </label>
                        <Field
                          as="textarea"
                          name="mission"
                          rows={3}
                          placeholder="Enter strategic mission statements..."
                          className={fc}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center justify-end gap-3 pt-3">
                    <CustomButton variant="cancel" onClick={onClose} className="w-fit!">
                      Cancel
                    </CustomButton>
                    <CustomButton type="submit" loading={saving} className="w-fit!">
                      {editing ? 'Save Changes' : 'Create Department'}
                    </CustomButton>
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

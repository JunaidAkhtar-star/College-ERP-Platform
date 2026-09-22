'use client';

import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { X, CheckCircle } from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import type { ISubject } from '../types/subjects.types';

const TYPES = ['Theory', 'Practical', 'Project', 'Seminar', 'Elective', 'Open Elective'];
const CATEGORIES = [
  'Core',
  'Professional Elective',
  'Open Elective',
  'Mandatory',
  'Audit',
  'Extra-Curricular',
];

const schema = Yup.object({
  code: Yup.string().trim().required('Subject code is required'),
  name: Yup.string().trim().required('Subject name is required'),
  shortName: Yup.string().trim().required('Short name is required'),
  departmentId: Yup.string().required('Department selection is required'),
  type: Yup.string().required('Subject type is required'),
  category: Yup.string().required('Subject category is required'),
  credits: Yup.number()
    .typeError('Credits must be a number')
    .min(0, 'Minimum 0 credits')
    .max(10, 'Maximum 10 credits')
    .required('Credit value is required'),
  lectureHours: Yup.number()
    .typeError('Lecture hours must be a number')
    .min(0, 'Minimum 0 hours')
    .required('Lecture hours required'),
  tutorialHours: Yup.number()
    .typeError('Tutorial hours must be a number')
    .min(0, 'Minimum 0 hours')
    .required('Tutorial hours required'),
  practicalHours: Yup.number()
    .typeError('Practical hours must be a number')
    .min(0, 'Minimum 0 hours')
    .required('Practical hours required'),
  internalMarks: Yup.number()
    .typeError('Internal max marks must be a number')
    .min(0, 'Minimum 0 marks')
    .required('Internal marks required'),
  externalMarks: Yup.number()
    .typeError('External max marks must be a number')
    .min(0, 'Minimum 0 marks')
    .required('External marks required'),
  passMarksInternal: Yup.number()
    .typeError('Internal pass marks must be a number')
    .min(0, 'Minimum 0 marks')
    .required('Internal pass marks required'),
  passMarksExternal: Yup.number()
    .typeError('External pass marks must be a number')
    .min(0, 'Minimum 0 marks')
    .required('External pass marks required'),
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
  editing: ISubject | null;
  saving: boolean;
  onClose: () => void;
  onSave: (v: Partial<ISubject>) => Promise<void>;
}

export default function SubjectModal({ open, editing, saving, onClose, onSave }: IProps) {
  const initial = {
    code: editing?.code ?? '',
    name: editing?.name ?? '',
    shortName: editing?.shortName ?? '',
    departmentId: editing?.departmentId ?? '',
    departmentCode: editing?.departmentCode ?? '',
    type: editing?.type ?? 'Theory',
    category: editing?.category ?? 'Core',
    credits: editing?.credits ?? 3,
    lectureHours: editing?.lectureHours ?? 3,
    tutorialHours: editing?.tutorialHours ?? 0,
    practicalHours: editing?.practicalHours ?? 0,
    internalMarks: editing?.internalMarks ?? 30,
    externalMarks: editing?.externalMarks ?? 70,
    passMarksInternal: editing?.passMarksInternal ?? 12,
    passMarksExternal: editing?.passMarksExternal ?? 28,
    hasLabComponent: editing?.hasLabComponent ?? false,
    isElective: editing?.isElective ?? false,
    bputPaperCode: editing?.bputPaperCode ?? '',
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
            className="relative z-10 flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-2xl bg-white p-6  "
          >
            <div className="flex shrink-0 items-center justify-between pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editing ? 'Edit Subject Master' : 'Add New Subject'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing
                    ? `Update course details for ${editing.code} - ${editing.name}`
                    : 'Create a reusable subject entry in the institutional course catalog.'}
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
              onSubmit={(values) => onSave(values as Partial<ISubject>)}
            >
              {({ values, setFieldValue }) => (
                <Form className="flex flex-col  overflow-hidden flex-1 space-y-6 pt-3">
                  <div className="overflow-y-auto flex-1  space-y-6 p-2 py-3">
                    {/* Subject Identification */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Subject Code <span className="text-red-500">*</span>
                        </label>
                        <Field name="code" placeholder="e.g. CS501" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Unique subject catalog code.
                        </p>
                        <FE name="code" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Subject Title / Name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="name"
                          placeholder="e.g. Data Structures & Algorithms"
                          className={fc}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Full official course title.
                        </p>
                        <FE name="name" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Short Name / Abbreviation <span className="text-red-500">*</span>
                        </label>
                        <Field name="shortName" placeholder="e.g. DSA" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Abbreviated label used in compact tables.
                        </p>
                        <FE name="shortName" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          BPUT / University Paper Code
                        </label>
                        <Field
                          name="bputPaperCode"
                          placeholder="e.g. R-CS501-2024"
                          className={fc}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Official university evaluation code.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Owning Department <span className="text-red-500">*</span>
                      </label>
                      <AsyncSelect
                        type="departments"
                        required
                        value={values.departmentId || null}
                        onChange={(v, opt) => {
                          setFieldValue('departmentId', v ?? '');
                          if (opt?.sub) setFieldValue('departmentCode', opt.sub);
                        }}
                        placeholder="Search & select owning department..."
                      />
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        Department responsible for conducting this subject.
                      </p>
                      <FE name="departmentId" />
                    </div>

                    {/* Classification & Credits */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Total Credits <span className="text-red-500">*</span>
                        </label>
                        <Field name="credits" type="number" min="0" max="10" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Academic credit weight (0 - 10).
                        </p>
                        <FE name="credits" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Subject Type <span className="text-red-500">*</span>
                        </label>
                        <Field as="select" name="type" className={fc}>
                          {TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </Field>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Pedagogical course format.
                        </p>
                        <FE name="type" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Category <span className="text-red-500">*</span>
                        </label>
                        <Field as="select" name="category" className={fc}>
                          {CATEGORIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </Field>
                        <p className="mt-1 text-[11px] text-slate-500">Curriculum grouping slot.</p>
                        <FE name="category" />
                      </div>
                    </div>

                    {/* Hours Distribution */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Lecture Hours (L) <span className="text-red-500">*</span>
                        </label>
                        <Field name="lectureHours" type="number" min="0" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Weekly classroom contact hrs.
                        </p>
                        <FE name="lectureHours" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Tutorial Hours (T) <span className="text-red-500">*</span>
                        </label>
                        <Field name="tutorialHours" type="number" min="0" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Weekly tutorial discussion hrs.
                        </p>
                        <FE name="tutorialHours" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Practical Hours (P) <span className="text-red-500">*</span>
                        </label>
                        <Field name="practicalHours" type="number" min="0" className={fc} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Weekly laboratory/field hrs.
                        </p>
                        <FE name="practicalHours" />
                      </div>
                    </div>

                    {/* Marking Scheme */}
                    <div className="rounded-2xl bg-slate-50 p-5 space-y-4">
                      <h4 className="text-xs font-bold text-slate-800">
                        Evaluation & Pass Marks Breakdown
                      </h4>
                      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                            Internal Max <span className="text-red-500">*</span>
                          </label>
                          <Field name="internalMarks" type="number" className={fc} />
                          <p className="mt-1 text-[11px] text-slate-500">Continuous eval max.</p>
                          <FE name="internalMarks" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                            External Max <span className="text-red-500">*</span>
                          </label>
                          <Field name="externalMarks" type="number" className={fc} />
                          <p className="mt-1 text-[11px] text-slate-500">Semester exam max.</p>
                          <FE name="externalMarks" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                            Internal Pass <span className="text-red-500">*</span>
                          </label>
                          <Field name="passMarksInternal" type="number" className={fc} />
                          <p className="mt-1 text-[11px] text-slate-500">Min internal cut-off.</p>
                          <FE name="passMarksInternal" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                            External Pass <span className="text-red-500">*</span>
                          </label>
                          <Field name="passMarksExternal" type="number" className={fc} />
                          <p className="mt-1 text-[11px] text-slate-500">Min external cut-off.</p>
                          <FE name="passMarksExternal" />
                        </div>
                      </div>
                    </div>

                    {/* Card-Style Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div
                        onClick={() => setFieldValue('hasLabComponent', !values.hasLabComponent)}
                        className={`group flex items-start gap-3 rounded-xl p-4 border transition-all cursor-pointer select-none ${
                          values.hasLabComponent
                            ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            values.hasLabComponent
                              ? 'bg-purple-600 border-purple-600 text-white'
                              : 'bg-white border-slate-300 group-hover:border-slate-400'
                          }`}
                        >
                          {values.hasLabComponent && <CheckCircle className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 block">
                            Has Lab Component
                          </span>
                          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                            Indicates this subject requires lab sessions or practical assessments.
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={() => setFieldValue('isElective', !values.isElective)}
                        className={`group flex items-start gap-3 rounded-xl p-4 border transition-all cursor-pointer select-none ${
                          values.isElective
                            ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            values.isElective
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'bg-white border-slate-300 group-hover:border-slate-400'
                          }`}
                        >
                          {values.isElective && <CheckCircle className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 block">
                            Is Elective Course
                          </span>
                          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                            Mark as an elective choice for student course registration.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-end gap-3 pt-3">
                    <CustomButton variant="cancel" onClick={onClose} className="w-fit!">
                      Cancel
                    </CustomButton>
                    <CustomButton type="submit" loading={saving} className="w-fit!">
                      {editing ? 'Save Changes' : 'Add Subject'}
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

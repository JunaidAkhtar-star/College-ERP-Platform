'use client';

/**
 * @file FeeStructuresTab.tsx
 * @description Admin tab — list fee structures, create a new structure with feeItems array.
 * @module features/role-wise-features/fee/components
 */

import React, { useState } from 'react';
import { FieldArray, Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { Plus, Trash2, X, Layers } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import type { IFeeStructure, IFeeStructureFormDto } from '../types/Fee.types';

const FEE_TYPES = [
  'Tuition',
  'Development',
  'Examination',
  'Library',
  'Laboratory',
  'Hostel',
  'Transport',
  'Sports & Cultural',
  'Alumni',
  'Caution Money',
  'Registration',
  'Late Fee',
  'Miscellaneous',
];

function getSemestersForProgram(program: string): number {
  const p = (program ?? '').toUpperCase();
  if (p.includes('B.TECH') || p.includes('BTECH') || p.includes('BACHELOR OF TECHNOLOGY')) {
    return 8;
  }
  if (p.includes('M.TECH') || p.includes('MTECH') || p.includes('MASTER OF TECHNOLOGY')) {
    return 4;
  }
  if (p.includes('MBA') || p.includes('MASTER OF BUSINESS')) {
    return 4;
  }
  if (p.includes('MCA') || p.includes('MASTER OF COMPUTER')) {
    return 4;
  }
  if (
    p.includes('BCA') ||
    p.includes('B.CA') ||
    p.includes('BSC') ||
    p.includes('B.SC') ||
    p.includes('BBA') ||
    p.includes('B.BA')
  ) {
    return 6;
  }
  if (p.includes('PHD') || p.includes('PH.D') || p.includes('DOCTORAL')) {
    return 10;
  }
  if (p.includes('DIPLOMA')) {
    return 6;
  }
  return 8; // Default fallback
}

const schema = Yup.object({
  curriculumId: Yup.string().required('Required'),
  departmentId: Yup.string().required('Required'),
  program: Yup.string().required('Required'),
  branch: Yup.string().required('Required'),
  semester: Yup.number().min(1).max(10).required('Required'),
  academicYear: Yup.string().required('Required'),
  category: Yup.string().required('Required'),
  feeItems: Yup.array()
    .of(
      Yup.object({
        type: Yup.string().required('Type required'),
        description: Yup.string().nullable(),
        amount: Yup.number().min(0, 'Must be ≥ 0').required('Amount required'),
      }),
    )
    .min(1, 'At least one fee item'),
});

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

export default function FeeStructuresTab() {
  const [showModal, setShowModal] = useState(false);
  const { data: raw, isLoading, isValidating, mutate } = useSwr('fee/structures');

  const { mutation, isLoading: saving } = useMutation();

  const structures: IFeeStructure[] =
    (raw as { data?: IFeeStructure[] | { data?: IFeeStructure[] } })?.data &&
    Array.isArray((raw as { data?: IFeeStructure[] }).data)
      ? ((raw as { data: IFeeStructure[] }).data as IFeeStructure[])
      : ((raw as { data?: { data?: IFeeStructure[] } })?.data?.data ?? []);

  const totalOf = (s: IFeeStructure) =>
    (s.feeItems ?? []).reduce((sum, fi) => sum + (fi.amount ?? 0), 0);

  const columns: Column<IFeeStructure>[] = [
    {
      field: 'program',
      title: 'Program',
      render: (r) => `${r.program} · ${r.branch}`,
    },
    { field: 'semester', title: 'Sem' },
    { field: 'academicYear', title: 'Academic Year' },
    { field: 'category', title: 'Category' },
    {
      field: 'feeItems',
      title: 'Items',
      render: (r) => `${(r.feeItems ?? []).length} items`,
    },
    {
      field: 'amount' as keyof IFeeStructure,
      title: 'Total',
      render: (r) => (
        <span className="font-semibold text-slate-800">₹{totalOf(r).toLocaleString()}</span>
      ),
    },
  ];

  const initialValues: IFeeStructureFormDto = {
    curriculumId: '',
    departmentId: '',
    batchId: '',
    program: '',
    branch: '',
    semester: 1,
    academicYear: '',
    category: 'General',
    feeItems: [{ type: 'Tuition', description: '', amount: 0 }],
  };

  const handleCreate = async (values: IFeeStructureFormDto, helpers: { resetForm: () => void }) => {
    const body = { ...values, batchId: values.batchId || undefined };
    const r = await mutation('fee/structures', { method: 'POST', body, isAlert: true });
    if (r?.results?.success) {
      toast.success('Fee structure created');
      helpers.resetForm();
      setShowModal(false);
      mutate();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white overflow-hidden">
        <CustomTable
          title="Fee Structures"
          subtitle="Define program · branch · semester · academic-year fee templates"
          data={structures}
          columns={columns}
          isLoading={isLoading}
          isValidating={isValidating}
          onRefresh={() => void mutate()}
          customActions={
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowModal(true)}
            >
              New Structure
            </CustomButton>
          }
          options={{
            toolbar: true,
            search: true,
            refresh: true,
            export: false,
            pagination: true,
            pageSize: 10,
          }}
          localization={{ toolbar: { searchPlaceholder: 'Search structures...' } }}
        />
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-2xl rounded-2xl bg-white"
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-slate-800">New Fee Structure</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Formik<IFeeStructureFormDto>
                initialValues={initialValues}
                validationSchema={schema}
                onSubmit={handleCreate}
              >
                {({ values, setFieldValue, touched, errors }) => {
                  const total = (values.feeItems ?? []).reduce(
                    (s, fi) => s + (Number(fi.amount) || 0),
                    0,
                  );
                  return (
                    <Form className="max-h-[70dvh] overflow-y-auto px-6 py-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <AsyncSelect
                          label="Curriculum"
                          type="curricula"
                          value={values.curriculumId || null}
                          onChange={(value, option) => {
                            setFieldValue('curriculumId', value ?? '');
                            setFieldValue('departmentId', '');
                            setFieldValue('batchId', '');
                            setFieldValue('program', option?.label.split(' · ')[0] ?? '');
                          }}
                          error={
                            touched.curriculumId && errors.curriculumId
                              ? String(errors.curriculumId)
                              : undefined
                          }
                          required
                        />
                        <AsyncSelect
                          label="Department"
                          type="departments"
                          params={{ curriculumId: values.curriculumId }}
                          value={values.departmentId || null}
                          onChange={(value, option) => {
                            setFieldValue('departmentId', value ?? '');
                            setFieldValue('batchId', '');
                            setFieldValue('branch', option?.label.split(' · ')[0] ?? '');
                          }}
                          disabled={!values.curriculumId}
                          error={
                            touched.departmentId && errors.departmentId
                              ? String(errors.departmentId)
                              : undefined
                          }
                          required
                        />
                      </div>
                      <AsyncSelect
                        label="Batch"
                        type="batches"
                        params={{ master: true }}
                        value={values.batchId || null}
                        onChange={(value) => setFieldValue('batchId', value ?? '')}
                        placeholder="Optional batch-specific fee"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Program</label>
                          <Field name="program" className={inputCls} readOnly />
                        </div>
                        <div>
                          <label className={labelCls}>Branch</label>
                          <Field name="branch" className={inputCls} readOnly />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className={labelCls}>Semester *</label>
                          <Field
                            as="select"
                            name="semester"
                            className={inputCls}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                              setFieldValue('semester', Number(e.target.value))
                            }
                          >
                            {Array.from(
                              { length: getSemestersForProgram(values.program) },
                              (_, i) => i + 1,
                            ).map((s) => (
                              <option key={s} value={s}>
                                Semester {s}
                              </option>
                            ))}
                          </Field>
                          <ErrorMessage name="semester">
                            {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                          </ErrorMessage>
                        </div>
                        <div>
                          <label className={labelCls}>Academic Year *</label>
                          <AsyncSelect
                            type="academicYears"
                            value={values.academicYear || null}
                            onChange={(value) => setFieldValue('academicYear', value ?? '')}
                            placeholder="Select academic year"
                            required
                          />
                          <ErrorMessage name="academicYear">
                            {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                          </ErrorMessage>
                        </div>
                        <div>
                          <label className={labelCls}>Category *</label>
                          <Field as="select" name="category" className={inputCls}>
                            <option>General</option>
                            <option>SC</option>
                            <option>ST</option>
                            <option>OBC</option>
                            <option>EWS</option>
                            <option>Lateral Entry</option>
                          </Field>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700">Fee Items</p>
                          <span className="text-sm font-bold text-primary">
                            Total: ₹{total.toLocaleString()}
                          </span>
                        </div>
                        <FieldArray name="feeItems">
                          {({ push, remove }) => (
                            <div className="space-y-2">
                              {values.feeItems.map((_, idx) => (
                                <div
                                  key={idx}
                                  className="grid grid-cols-12 items-start gap-2 rounded-lg bg-slate-50 p-2"
                                >
                                  <div className="col-span-4">
                                    <Field
                                      as="select"
                                      name={`feeItems.${idx}.type`}
                                      className={inputCls}
                                    >
                                      {FEE_TYPES.map((t) => (
                                        <option key={t}>{t}</option>
                                      ))}
                                    </Field>
                                    <ErrorMessage name={`feeItems.${idx}.type`}>
                                      {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                                    </ErrorMessage>
                                  </div>
                                  <div className="col-span-5">
                                    <Field
                                      name={`feeItems.${idx}.description`}
                                      placeholder="Description (optional)"
                                      className={inputCls}
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <Field
                                      type="number"
                                      name={`feeItems.${idx}.amount`}
                                      placeholder="0"
                                      className={inputCls}
                                    />
                                    <ErrorMessage name={`feeItems.${idx}.amount`}>
                                      {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                                    </ErrorMessage>
                                  </div>
                                  <div className="col-span-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => remove(idx)}
                                      disabled={values.feeItems.length === 1}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() =>
                                  push({ type: 'Tuition', description: '', amount: 0 })
                                }
                                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <Plus className="h-3.5 w-3.5" /> Add item
                              </button>
                            </div>
                          )}
                        </FieldArray>
                        <ErrorMessage name="feeItems">
                          {(m) =>
                            typeof m === 'string' ? (
                              <p className="mt-1 text-xs text-red-500">{m}</p>
                            ) : null
                          }
                        </ErrorMessage>
                      </div>

                      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                        <CustomButton
                          variant="cancel"
                          type="button"
                          onClick={() => setShowModal(false)}
                        >
                          Cancel
                        </CustomButton>
                        <CustomButton type="submit" loading={saving} loadingText="Saving…">
                          Create Structure
                        </CustomButton>
                      </div>
                    </Form>
                  );
                }}
              </Formik>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

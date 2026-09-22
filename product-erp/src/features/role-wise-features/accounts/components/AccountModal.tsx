/**
 * @file AccountModal.tsx
 * @description Create / edit transaction modal with Formik + Yup.
 *              All fields match the backend AccountsTransaction schema.
 * @module features/role-wise-features/accounts/components
 */

'use client';

import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import type {
  IAccountTransaction,
  ICreateTransactionDto,
  TTransactionType,
  TPaymentMode,
} from '../types/accounts.types';

// ── Options ───────────────────────────────────────────────────────────────────

const TRANSACTION_TYPES: { value: TTransactionType; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
];

const PAYMENT_MODES: { value: TPaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'dd', label: 'Demand Draft (DD)' },
];

const INCOME_CATEGORIES = [
  'Tuition Fee',
  'Development Fee',
  'Hostel Fee',
  'Transport Fee',
  'Exam Fee',
  'Library Fee',
  'Grant',
  'Donation',
  'Other Income',
];

const EXPENSE_CATEGORIES = [
  'Salary',
  'Infrastructure',
  'Maintenance',
  'Equipment',
  'Utilities',
  'Library',
  'Events',
  'Marketing',
  'IT & Software',
  'Travel',
  'Other Expense',
];

// ── Validation ────────────────────────────────────────────────────────────────

const schema = Yup.object({
  transactionType: Yup.string().oneOf(['income', 'expense']).required('Type is required'),
  category: Yup.string().min(2, 'Min 2 chars').required('Category is required'),
  subCategory: Yup.string().optional(),
  amount: Yup.number()
    .typeError('Must be a number')
    .positive('Must be greater than 0')
    .required('Amount is required'),
  paymentMode: Yup.string().required('Payment mode is required'),
  referenceNo: Yup.string().optional(),
  description: Yup.string().min(3, 'Min 3 characters').required('Description is required'),
  date: Yup.string().required('Date is required'),
  financialYear: Yup.string()
    .matches(/^\d{4}-\d{2}$/, 'Format: YYYY-YY (e.g. 2025-26)')
    .required('Financial year is required'),
  budgetHead: Yup.string().optional(),
  departmentId: Yup.string().optional(),
});

// ── Field error ───────────────────────────────────────────────────────────────

function FieldError({ name }: { name: string }) {
  return (
    <ErrorMessage name={name}>
      {(msg) => <p className="mt-1 text-xs text-red-500">{msg}</p>}
    </ErrorMessage>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

const fieldCls =
  'mt-1 w-full rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-primary';

// ── Props ─────────────────────────────────────────────────────────────────────

interface IProps {
  open: boolean;
  editing: IAccountTransaction | null;
  saving: boolean;
  defaultFy: string;
  onClose: () => void;
  onSave: (values: ICreateTransactionDto) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountModal({
  open,
  editing,
  saving,
  defaultFy,
  onClose,
  onSave,
}: IProps) {
  const todayIso = new Date().toISOString().split('T')[0];

  const initial: ICreateTransactionDto = {
    transactionType: editing?.transactionType ?? 'income',
    category: editing?.category ?? '',
    subCategory: editing?.subCategory ?? '',
    amount: editing?.amount ?? '',
    paymentMode: editing?.paymentMode ?? 'bank_transfer',
    referenceNo: editing?.referenceNo ?? '',
    description: editing?.description ?? '',
    date: editing?.date ? editing.date.split('T')[0] : todayIso,
    financialYear: editing?.financialYear ?? defaultFy,
    budgetHead: editing?.budgetHead ?? '',
    departmentId:
      typeof editing?.departmentId === 'object'
        ? editing.departmentId._id
        : (editing?.departmentId ?? ''),
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white max-h-[92dvh] flex flex-col  overflow-hidden"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editing ? 'Edit Institutional Transaction' : 'Record New Accounts Transaction'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing
                    ? `Modifying entry ref: ${editing.referenceNo || editing.description}`
                    : 'Post a new income or expense voucher to the general financial ledger'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Scrollable form body */}
            <Formik
              initialValues={initial}
              enableReinitialize
              validationSchema={schema}
              onSubmit={onSave}
            >
              {({ values, setFieldValue }) => {
                const categories =
                  values.transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

                return (
                  <Form className="overflow-y-auto flex-1">
                    <div className="p-6 space-y-5">
                      {/* Guided Ledger Banner */}
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-950">
                        <p className="font-semibold text-blue-900">
                          Institutional Financial Ledger Entry Guidance
                        </p>
                        <p className="mt-1 text-blue-700 leading-relaxed">
                          All recorded vouchers are indexed by <strong>Financial Year</strong> and{' '}
                          <strong>Budget Head</strong>. Ensure transaction reference numbers (UTR,
                          Cheque No, DD) match bank statements for reconciliation.
                        </p>
                      </div>

                      {/* Transaction type toggle */}
                      <div>
                        <Label required>Transaction Type</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {TRANSACTION_TYPES.map((t) => (
                            <Field key={t.value} name="transactionType">
                              {({
                                field,
                                form,
                              }: {
                                field: { value: string };
                                form: { setFieldValue: (n: string, v: string) => void };
                              }) => (
                                <button
                                  type="button"
                                  onClick={() => form.setFieldValue('transactionType', t.value)}
                                  className={`rounded-lg border-2 py-2.5 text-sm font-semibold transition-all ${
                                    field.value === t.value
                                      ? t.value === 'income'
                                        ? 'border-secondary bg-secondary-50 text-secondary'
                                        : 'border-red-400 bg-red-50 text-red-500'
                                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              )}
                            </Field>
                          ))}
                        </div>
                        <FieldError name="transactionType" />
                      </div>

                      {/* Description */}
                      <div>
                        <Label required>Description</Label>
                        <Field
                          name="description"
                          placeholder="e.g. Tuition fee — Batch 2023"
                          className={fieldCls}
                        />
                        <FieldError name="description" />
                      </div>

                      {/* Category + Sub-category */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label required>Category</Label>
                          <Field as="select" name="category" className={fieldCls}>
                            <option value="">Select category…</option>
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </Field>
                          <FieldError name="category" />
                        </div>
                        <div>
                          <Label>Sub-category</Label>
                          <Field name="subCategory" placeholder="Optional" className={fieldCls} />
                          <FieldError name="subCategory" />
                        </div>
                      </div>

                      {/* Amount + Payment mode */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label required>Amount (₹)</Label>
                          <Field
                            name="amount"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className={fieldCls}
                          />
                          <FieldError name="amount" />
                        </div>
                        <div>
                          <Label required>Payment Mode</Label>
                          <Field as="select" name="paymentMode" className={fieldCls}>
                            {PAYMENT_MODES.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </Field>
                          <FieldError name="paymentMode" />
                        </div>
                      </div>

                      {/* Date + Financial year */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label required>Date</Label>
                          <Field name="date" type="date" className={fieldCls} />
                          <FieldError name="date" />
                        </div>
                        <div>
                          <Label required>Financial Year</Label>
                          <Field
                            name="financialYear"
                            placeholder="e.g. 2025-26"
                            className={fieldCls}
                          />
                          <FieldError name="financialYear" />
                        </div>
                      </div>

                      {/* Reference No + Budget head */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Reference / Cheque No.</Label>
                          <Field
                            name="referenceNo"
                            placeholder="e.g. CHQ-001234"
                            className={fieldCls}
                          />
                          <FieldError name="referenceNo" />
                        </div>
                        <div>
                          <Label>Budget Head</Label>
                          <Field
                            name="budgetHead"
                            placeholder="e.g. Capital Expenditure"
                            className={fieldCls}
                          />
                          <FieldError name="budgetHead" />
                        </div>
                      </div>

                      {/* Department */}
                      <div>
                        <Label>Department (optional)</Label>
                        <AsyncSelect
                          type="departments"
                          placeholder="— Not department-specific —"
                          value={values.departmentId || null}
                          onChange={(v) => setFieldValue('departmentId', v ?? '')}
                        />
                        <FieldError name="departmentId" />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                      <CustomButton variant="cancel" onClick={onClose} className="w-fit!">
                        Cancel
                      </CustomButton>
                      <CustomButton type="submit" loading={saving} className="w-fit!">
                        {editing ? 'Save Changes' : 'Record Transaction'}
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
  );
}

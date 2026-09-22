'use client';

import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import {
  BadgeIndianRupee,
  Check,
  Download,
  FileCheck2,
  Landmark,
  Plus,
  RefreshCcw,
  Split,
  Upload,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { IFeeRecord, IFeeTransaction } from '../types/Fee.types';
import AsyncSelect from '@/shared/core/AsyncSelect';

interface IAdjustment extends Record<string, unknown> {
  _id: string;
  feeRecordId: string;
  kind: 'concession' | 'waiver' | 'late_fee';
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
}
interface IRefund extends Record<string, unknown> {
  _id: string;
  feeRecordId: string;
  transactionId: string;
  amount: number;
  destination: string;
  status: 'requested' | 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled';
  reference?: string;
}
interface IPlan extends Record<string, unknown> {
  _id: string;
  feeRecordId: string;
  status: string;
  installments: Array<{
    sequence: number;
    label: string;
    amount: number;
    dueDate: string;
    status: string;
  }>;
}
interface IReconciliation extends Record<string, unknown> {
  _id: string;
  provider: string;
  statementReference: string;
  transactionReference: string;
  amount: number;
  status: 'unmatched' | 'matched' | 'exception';
}
interface IAdvancedData {
  plans: IPlan[];
  adjustments: IAdjustment[];
  refunds: IRefund[];
  reconciliation: IReconciliation[];
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}

interface IReconciliationImportRow {
  transactionReference: string;
  amount: number;
  paidAt: string;
}

interface IReconciliationImport {
  name: string;
  rows: IReconciliationImportRow[];
}

const MAX_RECONCILIATION_BYTES = 5 * 1024 * 1024;
const MAX_RECONCILIATION_ROWS = 5000;

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white transition-all';
const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600';

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else value += character;
  }
  if (quoted) throw new Error('A quoted CSV value is not closed.');
  values.push(value.trim());
  return values;
}

function parseReconciliationCsv(text: string): IReconciliationImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error('The CSV file does not contain transaction rows.');
  if (lines.length - 1 > MAX_RECONCILIATION_ROWS) {
    throw new Error(`Import at most ${MAX_RECONCILIATION_ROWS.toLocaleString('en-IN')} rows.`);
  }
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const required = ['transactionreference', 'amount', 'paidat'];
  const positions = new Map(headers.map((header, index) => [header, index]));
  const missing = required.filter((header) => !positions.has(header));
  if (missing.length) {
    throw new Error('Use the template columns: transactionReference, amount and paidAt.');
  }
  const references = new Set<string>();
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const get = (key: string) => values[positions.get(key) ?? -1]?.trim() ?? '';
    const transactionReference = get('transactionreference');
    const amount = Number(get('amount'));
    const paidAt = get('paidat');
    const parsedDate = new Date(paidAt);
    if (!transactionReference)
      throw new Error(`Row ${rowIndex + 2} needs a transaction reference.`);
    if (references.has(transactionReference.toLowerCase())) {
      throw new Error(`Row ${rowIndex + 2} repeats transaction reference ${transactionReference}.`);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Row ${rowIndex + 2} has an invalid amount.`);
    }
    if (!paidAt || Number.isNaN(parsedDate.getTime())) {
      throw new Error(`Row ${rowIndex + 2} has an invalid payment date.`);
    }
    references.add(transactionReference.toLowerCase());
    return { transactionReference, amount, paidAt: parsedDate.toISOString() };
  });
}

function downloadReconciliationTemplate() {
  const content = 'transactionReference,amount,paidAt\nTXN-123,25000,2026-07-20';
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'fee-reconciliation-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdvancedFeesTab() {
  const { data: advancedRaw, mutate: refresh } =
    useSwr<IApiResponse<IAdvancedData>>('fee/advanced');
  const { data: recordsRaw } = useSwr<{ data?: IFeeRecord[] }>('fee/records?limit=200');
  const { mutation, isLoading } = useMutation();
  const data = advancedRaw?.data;
  const records: IFeeRecord[] = useMemo(() => {
    return recordsRaw?.data ?? [];
  }, [recordsRaw]);

  const [subTab, setSubTab] = useState<
    'installments' | 'adjustments' | 'refunds' | 'reconciliation'
  >('installments');
  const [panel, setPanel] = useState<
    'adjustment' | 'installments' | 'refund' | 'complete_refund' | 'reconcile' | null
  >(null);

  const [provider, setProvider] = useState('');
  const [statementReference, setStatementReference] = useState('');
  const [reconciliationImport, setReconciliationImport] = useState<IReconciliationImport | null>(
    null,
  );
  const [reconciliationError, setReconciliationError] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<IRefund | null>(null);
  const [refundReference, setRefundReference] = useState('');

  // Stores currently selected record details via AsyncSelect meta data
  const [selectedRecord, setSelectedRecord] = useState<{
    balanceDue: number;
    transactions: IFeeTransaction[];
  } | null>(null);

  const mutateAndRefresh = async (
    path: string,
    options: { method: 'POST' | 'PATCH'; body: object },
  ) => {
    const response = await mutation(path, options);
    if (!response?.results?.success) return false;
    await refresh();
    return true;
  };

  const handleAdjustmentSubmit = async (
    values: { recordId: string; kind: IAdjustment['kind']; amount: number; reason: string },
    { resetForm }: { resetForm: () => void },
  ) => {
    if (
      await mutateAndRefresh(`fee/${values.recordId}/adjustments`, {
        method: 'POST',
        body: { kind: values.kind, amount: values.amount, reason: values.reason },
      })
    ) {
      toast.success('Adjustment submitted for approval');
      setPanel(null);
      setSelectedRecord(null);
      resetForm();
    }
  };

  const handleInstallmentSubmit = async (
    values: { recordId: string; installmentCount: number; firstDueDate: string },
    { resetForm }: { resetForm: () => void },
  ) => {
    if (!selectedRecord) return;

    const base = Math.floor((selectedRecord.balanceDue * 100) / values.installmentCount) / 100;
    const installments = Array.from({ length: values.installmentCount }, (_, index) => {
      const dueDate = new Date(values.firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + index);
      const regularTotal = base * (values.installmentCount - 1);
      return {
        label: `Installment ${index + 1}`,
        amount:
          index === values.installmentCount - 1
            ? Number((selectedRecord.balanceDue - regularTotal).toFixed(2))
            : base,
        dueDate: dueDate.toISOString(),
      };
    });

    if (
      await mutateAndRefresh(`fee/${values.recordId}/installments`, {
        method: 'POST',
        body: { installments },
      })
    ) {
      toast.success('Installment plan saved');
      setPanel(null);
      setSelectedRecord(null);
      resetForm();
    }
  };

  const handleRefundSubmit = async (
    values: {
      recordId: string;
      transactionId: string;
      amount: number;
      destination: string;
      reason: string;
    },
    { resetForm }: { resetForm: () => void },
  ) => {
    if (
      await mutateAndRefresh(`fee/${values.recordId}/refunds`, {
        method: 'POST',
        body: {
          transactionId: values.transactionId,
          amount: values.amount,
          reason: values.reason,
          destination: values.destination,
        },
      })
    ) {
      toast.success('Refund submitted for approval');
      setPanel(null);
      setSelectedRecord(null);
      resetForm();
    }
  };

  const submitReconciliation = async () => {
    if (!provider.trim() || !statementReference.trim() || !reconciliationImport?.rows.length) {
      toast.error('Enter the bank, statement reference and choose a valid CSV file');
      return;
    }
    if (
      await mutateAndRefresh('fee/reconciliation/import', {
        method: 'POST',
        body: { provider, statementReference, rows: reconciliationImport.rows },
      })
    ) {
      toast.success('Statement reconciled');
      setPanel(null);
      setReconciliationImport(null);
      setReconciliationError('');
    }
  };

  const completeRefund = async () => {
    if (!selectedRefund || refundReference.trim().length < 3) {
      toast.error('Enter the bank or gateway refund reference');
      return;
    }
    if (
      await mutateAndRefresh(`fee/refunds/${selectedRefund._id}/complete`, {
        method: 'PATCH',
        body: { reference: refundReference },
      })
    ) {
      toast.success('Refund paid and posted to the ledger');
      setPanel(null);
      setSelectedRefund(null);
      setRefundReference('');
    }
  };

  const reviewAdjustment = async (row: IAdjustment, decision: 'approved' | 'rejected') => {
    if (
      await mutateAndRefresh(`fee/adjustments/${row._id}/review`, {
        method: 'PATCH',
        body: { decision },
      })
    )
      toast.success(`Adjustment ${decision}`);
  };

  const reviewRefund = async (row: IRefund, decision: 'approved' | 'rejected') => {
    if (
      await mutateAndRefresh(`fee/refunds/${row._id}/review`, {
        method: 'PATCH',
        body: { decision },
      })
    )
      toast.success(`Refund ${decision}`);
  };

  const planColumns: Column<IPlan>[] = [
    {
      field: 'feeRecordId',
      title: 'Invoice / Student',
      render: (row) => {
        const record = records.find((r: IFeeRecord) => r._id === row.feeRecordId);
        return record ? `${record.invoiceNumber} · ${record.studentName}` : row.feeRecordId;
      },
    },
    {
      field: 'installments',
      title: 'Installments Summary',
      render: (row) => {
        const paidCount = row.installments.filter((i) => i.status === 'Paid').length;
        const total = row.installments.reduce((sum, item) => sum + item.amount, 0);
        return `${paidCount} / ${row.installments.length} paid (${money(total)})`;
      },
    },
    { field: 'status', title: 'Status', render: (row) => <Status value={row.status} /> },
  ];

  const adjustmentColumns: Column<IAdjustment>[] = [
    { field: 'kind', title: 'Type', render: (row) => row.kind.replace('_', ' ') },
    { field: 'amount', title: 'Amount', render: (row) => money(row.amount) },
    { field: 'reason', title: 'Reason' },
    { field: 'status', title: 'Status', render: (row) => <Status value={row.status} /> },
  ];

  const adjustmentActions: Action<IAdjustment>[] = [
    {
      icon: <Check size={15} />,
      tooltip: 'Approve',
      onClick: (row) => reviewAdjustment(row, 'approved'),
      hidden: (row) => row.status !== 'pending',
    },
    {
      icon: <X size={15} />,
      tooltip: 'Reject',
      onClick: (row) => reviewAdjustment(row, 'rejected'),
      hidden: (row) => row.status !== 'pending',
    },
  ];

  const refundColumns: Column<IRefund>[] = [
    { field: 'transactionId', title: 'Payment ID' },
    { field: 'amount', title: 'Amount', render: (row) => money(row.amount) },
    { field: 'destination', title: 'Destination' },
    { field: 'status', title: 'Status', render: (row) => <Status value={row.status} /> },
  ];

  const refundActions: Action<IRefund>[] = [
    {
      icon: <Check size={15} />,
      tooltip: 'Approve',
      onClick: (row) => reviewRefund(row, 'approved'),
      hidden: (row) => row.status !== 'requested',
    },
    {
      icon: <X size={15} />,
      tooltip: 'Reject',
      onClick: (row) => reviewRefund(row, 'rejected'),
      hidden: (row) => row.status !== 'requested',
    },
    {
      icon: <Landmark size={15} />,
      tooltip: 'Complete payout',
      onClick: (row) => {
        setSelectedRefund(row);
        setPanel('complete_refund');
      },
      hidden: (row) => !['approved', 'processing'].includes(row.status),
    },
  ];

  const reconciliationColumns: Column<IReconciliation>[] = [
    { field: 'provider', title: 'Provider' },
    { field: 'statementReference', title: 'Statement' },
    { field: 'transactionReference', title: 'Transaction reference' },
    { field: 'amount', title: 'Amount', render: (row) => money(row.amount) },
    { field: 'status', title: 'Result', render: (row) => <Status value={row.status} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Metrics Grid */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Active installment plans"
          value={(data?.plans ?? []).filter((row) => row.status === 'active').length}
          icon={<Split />}
        />
        <Metric
          label="Pending approvals"
          value={
            (data?.adjustments ?? []).filter((row) => row.status === 'pending').length +
            (data?.refunds ?? []).filter((row) => row.status === 'requested').length
          }
          icon={<BadgeIndianRupee />}
        />
        <Metric
          label="Unmatched statement rows"
          value={(data?.reconciliation ?? []).filter((row) => row.status !== 'matched').length}
          icon={<RefreshCcw />}
        />
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-2 border-b border-slate-100 pb-2">
        {[
          {
            key: 'installments',
            label: 'Installment Plans',
            count: (data?.plans ?? []).filter((r) => r.status === 'active').length,
          },
          {
            key: 'adjustments',
            label: 'Adjustments',
            count: (data?.adjustments ?? []).filter((r) => r.status === 'pending').length,
          },
          {
            key: 'refunds',
            label: 'Refunds',
            count: (data?.refunds ?? []).filter((r) => r.status === 'requested').length,
          },
          {
            key: 'reconciliation',
            label: 'Reconciliation',
            count: (data?.reconciliation ?? []).filter((r) => r.status !== 'matched').length,
          },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key as typeof subTab)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
              subTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  subTab === t.key ? 'bg-primary-50 text-primary' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conditional Table Display */}
      {subTab === 'installments' && (
        <CustomTable<IPlan>
          title="Installment Plans"
          description="View active split payment schedules defined for student records."
          columns={planColumns}
          data={data?.plans ?? []}
          customActions={
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setPanel('installments')}
            >
              Create Plan
            </CustomButton>
          }
        />
      )}
      {subTab === 'adjustments' && (
        <CustomTable<IAdjustment>
          title="Adjustment Approvals"
          description="Review pending concessions, waivers, and late fee adjustments."
          columns={adjustmentColumns}
          data={data?.adjustments ?? []}
          actions={adjustmentActions}
          customActions={
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setPanel('adjustment')}
            >
              Request Adjustment
            </CustomButton>
          }
        />
      )}
      {subTab === 'refunds' && (
        <CustomTable<IRefund>
          title="Refund Approvals"
          description="Manage refund requests, bank payout reviews, and payout tracking."
          columns={refundColumns}
          data={data?.refunds ?? []}
          actions={refundActions}
          customActions={
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setPanel('refund')}
            >
              Request Refund
            </CustomButton>
          }
        />
      )}
      {subTab === 'reconciliation' && (
        <CustomTable<IReconciliation>
          title="Bank Reconciliation Logs"
          description="Compare external bank statement items against ledger transactions."
          columns={reconciliationColumns}
          data={data?.reconciliation ?? []}
          customActions={
            <CustomButton
              variant="primary"
              startIcon={<RefreshCcw className="h-4 w-4" />}
              onClick={() => setPanel('reconcile')}
            >
              Reconcile Statement
            </CustomButton>
          }
        />
      )}

      {/* OVERLAY DIALOGS (MODALS) */}
      <AnimatePresence>
        {panel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-xs"
              onClick={() => {
                setPanel(null);
                setSelectedRecord(null);
              }}
            />
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-6  border border-slate-100 flex flex-col max-h-[85dvh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 capitalize">
                    {panel === 'reconcile' ? 'Reconcile Bank Statement' : panel.replace('_', ' ')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {panel === 'installments' &&
                      'Setup structured equal split payments for an outstanding invoice.'}
                    {panel === 'adjustment' &&
                      'Waiver, concession, or late fee modification request.'}
                    {panel === 'refund' &&
                      'Initiate payment return workflow for an invoice transaction.'}
                    {panel === 'reconcile' &&
                      'Import external bank files to matching system transactions.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null);
                    setSelectedRecord(null);
                  }}
                  className="rounded-lg p-1 text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body - Scrollable if content overflows */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
                {panel === 'installments' && (
                  <Formik
                    initialValues={{ recordId: '', installmentCount: 2, firstDueDate: '' }}
                    validationSchema={Yup.object({
                      recordId: Yup.string().required('Please select a fee invoice'),
                      installmentCount: Yup.number()
                        .integer()
                        .min(2, 'At least 2 installments')
                        .max(24, 'Maximum 24 installments')
                        .required('Required'),
                      firstDueDate: Yup.string().required('First due date is required'),
                    })}
                    onSubmit={handleInstallmentSubmit}
                  >
                    {({ setFieldValue, values }) => (
                      <Form className="space-y-4">
                        <div>
                          <AsyncSelect
                            type="feeRecords"
                            label="Fee Invoice *"
                            placeholder="Type Invoice Number or Roll Number to search..."
                            value={values.recordId}
                            onChange={(val, opt) => {
                              setFieldValue('recordId', val);
                              if (opt && opt.meta) {
                                setSelectedRecord({
                                  balanceDue: Number(opt.meta.balanceDue || 0),
                                  transactions: JSON.parse(String(opt.meta.transactions || '[]')),
                                });
                              } else {
                                setSelectedRecord(null);
                              }
                            }}
                          />
                          <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                            Select the {"student's"} active unpaid invoice to split into multiple
                            payment terms.
                          </p>
                          <ErrorMessage
                            name="recordId"
                            component="p"
                            className="mt-1 text-xs text-red-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Installment Count *</label>
                            <Field
                              type="number"
                              name="installmentCount"
                              min={2}
                              max={24}
                              className={inputCls}
                            />
                            <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                              Number of segments to divide the remaining balance into (e.g. 2, 3 or
                              4 months).
                            </p>
                            <ErrorMessage
                              name="installmentCount"
                              component="p"
                              className="mt-1 text-xs text-red-500"
                            />
                          </div>
                          <div>
                            <label className={labelCls}>First Due Date *</label>
                            <Field type="date" name="firstDueDate" className={inputCls} />
                            <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                              The date when the first installment payment is due. Subsequent
                              installments will automatically fall due on the same day in following
                              months.
                            </p>
                            <ErrorMessage
                              name="firstDueDate"
                              component="p"
                              className="mt-1 text-xs text-red-500"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                          <CustomButton
                            variant="cancel"
                            onClick={() => {
                              setPanel(null);
                              setSelectedRecord(null);
                            }}
                          >
                            Cancel
                          </CustomButton>
                          <CustomButton variant="primary" type="submit" loading={isLoading}>
                            Generate Schedule
                          </CustomButton>
                        </div>
                      </Form>
                    )}
                  </Formik>
                )}

                {panel === 'adjustment' && (
                  <Formik
                    initialValues={{
                      recordId: '',
                      kind: 'concession' as IAdjustment['kind'],
                      amount: '',
                      reason: '',
                    }}
                    validationSchema={Yup.object({
                      recordId: Yup.string().required('Please select a fee invoice'),
                      kind: Yup.string()
                        .oneOf(['concession', 'waiver', 'late_fee'])
                        .required('Required'),
                      amount: Yup.number()
                        .positive('Amount must be greater than 0')
                        .required('Amount is required'),
                      reason: Yup.string()
                        .min(5, 'Reason must be at least 5 characters')
                        .required('Reason is required'),
                    })}
                    onSubmit={(values, formikHelpers) => {
                      handleAdjustmentSubmit(
                        { ...values, amount: Number(values.amount) },
                        formikHelpers,
                      );
                    }}
                  >
                    {({ setFieldValue, values }) => (
                      <Form className="space-y-4">
                        <div>
                          <AsyncSelect
                            type="feeRecords"
                            label="Fee Invoice *"
                            placeholder="Type Invoice Number or Roll Number to search..."
                            value={values.recordId}
                            onChange={(val, opt) => {
                              setFieldValue('recordId', val);
                              if (opt && opt.meta) {
                                setSelectedRecord({
                                  balanceDue: Number(opt.meta.balanceDue || 0),
                                  transactions: JSON.parse(String(opt.meta.transactions || '[]')),
                                });
                              } else {
                                setSelectedRecord(null);
                              }
                            }}
                          />
                          <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                            Select the student invoice you wish to adjust.
                          </p>
                          <ErrorMessage
                            name="recordId"
                            component="p"
                            className="mt-1 text-xs text-red-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Adjustment Type *</label>
                            <Field as="select" name="kind" className={inputCls}>
                              <option value="concession">Concession</option>
                              <option value="waiver">Waiver</option>
                              <option value="late_fee">Late fee</option>
                            </Field>
                            <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                              Concession (general discount), Waiver (fee removal), or Late Fee
                              (additional penalty charge).
                            </p>
                            <ErrorMessage
                              name="kind"
                              component="p"
                              className="mt-1 text-xs text-red-500"
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Adjustment Amount (₹) *</label>
                            <Field
                              type="number"
                              name="amount"
                              placeholder="Amount"
                              className={inputCls}
                            />
                            <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                              The currency value to apply as a modification to the selected invoice.
                            </p>
                            <ErrorMessage
                              name="amount"
                              component="p"
                              className="mt-1 text-xs text-red-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Reason / Remarks *</label>
                          <Field
                            type="text"
                            name="reason"
                            placeholder="Reason details"
                            className={inputCls}
                          />
                          <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                            Explain why this modification is being requested (e.g. academic
                            scholarship waiver, late registration penalty).
                          </p>
                          <ErrorMessage
                            name="reason"
                            component="p"
                            className="mt-1 text-xs text-red-500"
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                          <CustomButton
                            variant="cancel"
                            onClick={() => {
                              setPanel(null);
                              setSelectedRecord(null);
                            }}
                          >
                            Cancel
                          </CustomButton>
                          <CustomButton variant="primary" type="submit" loading={isLoading}>
                            Submit for Approval
                          </CustomButton>
                        </div>
                      </Form>
                    )}
                  </Formik>
                )}

                {panel === 'refund' && (
                  <Formik
                    initialValues={{
                      recordId: '',
                      transactionId: '',
                      amount: '',
                      destination: '',
                      reason: '',
                    }}
                    validationSchema={Yup.object({
                      recordId: Yup.string().required('Please select a fee invoice'),
                      transactionId: Yup.string().required('Please select original transaction'),
                      amount: Yup.number()
                        .positive('Amount must be greater than 0')
                        .required('Amount is required'),
                      destination: Yup.string()
                        .min(3, 'Destination account details required')
                        .required('Required'),
                      reason: Yup.string()
                        .min(5, 'Reason must be at least 5 characters')
                        .required('Required'),
                    })}
                    onSubmit={(values, formikHelpers) => {
                      handleRefundSubmit(
                        { ...values, amount: Number(values.amount) },
                        formikHelpers,
                      );
                    }}
                  >
                    {({ setFieldValue, values }) => {
                      const resolvedRecord =
                        selectedRecord ||
                        records.find((r: IFeeRecord) => r._id === values.recordId) ||
                        null;
                      const transactions = resolvedRecord?.transactions ?? [];
                      return (
                        <Form className="space-y-4">
                          <div>
                            <AsyncSelect
                              type="feeRecords"
                              label="Fee Invoice *"
                              placeholder="Type Invoice Number or Roll Number to search..."
                              value={values.recordId}
                              params={{ outstandingOnly: false }}
                              onChange={(val, opt) => {
                                setFieldValue('recordId', val);
                                setFieldValue('transactionId', '');
                                if (opt && opt.meta) {
                                  setSelectedRecord({
                                    balanceDue: Number(opt.meta.balanceDue || 0),
                                    transactions: JSON.parse(String(opt.meta.transactions || '[]')),
                                  });
                                } else {
                                  setSelectedRecord(null);
                                }
                              }}
                            />
                            <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                              Select the student invoice containing the original transaction to be
                              refunded.
                            </p>
                            <ErrorMessage
                              name="recordId"
                              component="p"
                              className="mt-1 text-xs text-red-500"
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Original Payment Transaction *</label>
                            <Field
                              as="select"
                              name="transactionId"
                              className={inputCls}
                              disabled={!values.recordId || transactions.length === 0}
                            >
                              <option value="">
                                {transactions.length === 0
                                  ? 'No transactions available'
                                  : 'Select original payment'}
                              </option>
                              {transactions.map((transaction: IFeeTransaction) => (
                                <option
                                  key={transaction.transactionId}
                                  value={transaction.transactionId}
                                >
                                  {transaction.receiptNumber} · {money(transaction.amountPaid)} ·{' '}
                                  {transaction.paymentMode}
                                </option>
                              ))}
                            </Field>
                            <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                              Choose the specific transaction receipt that is being returned to the
                              student.
                            </p>
                            {values.recordId && transactions.length === 0 && (
                              <p className="mt-1.5 text-xs font-semibold text-amber-600">
                                Warning: No paid transactions exist on this invoice to process a
                                refund.
                              </p>
                            )}
                            <ErrorMessage
                              name="transactionId"
                              component="p"
                              className="mt-1 text-xs text-red-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={labelCls}>Refund Amount (₹) *</label>
                              <Field
                                type="number"
                                name="amount"
                                placeholder="Amount"
                                className={inputCls}
                              />
                              <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                                The amount to refund. Must not exceed the original transaction
                                value.
                              </p>
                              <ErrorMessage
                                name="amount"
                                component="p"
                                className="mt-1 text-xs text-red-500"
                              />
                            </div>
                            <div>
                              <label className={labelCls}>
                                Destination Account / Beneficiary *
                              </label>
                              <Field
                                type="text"
                                name="destination"
                                placeholder="Bank Account / Payout info"
                                className={inputCls}
                              />
                              <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                                Beneficiary details (e.g. Account Number, IFSC Code, and Holder
                                Name) for the payout transaction.
                              </p>
                              <ErrorMessage
                                name="destination"
                                component="p"
                                className="mt-1 text-xs text-red-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className={labelCls}>Refund Reason *</label>
                            <Field
                              type="text"
                              name="reason"
                              placeholder="Reason details"
                              className={inputCls}
                            />
                            <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                              Specify the reason for returning these funds (e.g., duplicate payment,
                              course cancellation).
                            </p>
                            <ErrorMessage
                              name="reason"
                              component="p"
                              className="mt-1 text-xs text-red-500"
                            />
                          </div>
                          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <CustomButton
                              variant="cancel"
                              onClick={() => {
                                setPanel(null);
                                setSelectedRecord(null);
                              }}
                            >
                              Cancel
                            </CustomButton>
                            <CustomButton variant="primary" type="submit" loading={isLoading}>
                              Submit Request
                            </CustomButton>
                          </div>
                        </Form>
                      );
                    }}
                  </Formik>
                )}

                {panel === 'complete_refund' && selectedRefund && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Refund Amount:</span>
                        <span className="font-bold text-slate-800">
                          {money(selectedRefund.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Payment ID:</span>
                        <span className="font-mono text-slate-700">
                          {selectedRefund.transactionId}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Destination:</span>
                        <span className="font-medium text-slate-800">
                          {selectedRefund.destination}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Bank / Gateway Reference *</label>
                      <input
                        value={refundReference}
                        onChange={(event) => setRefundReference(event.target.value)}
                        placeholder="Reference ID"
                        className={inputCls}
                      />
                      <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                        Enter the transaction ID or payout receipt code generated by your bank or
                        payment gateway.
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <CustomButton
                        variant="cancel"
                        onClick={() => {
                          setPanel(null);
                          setSelectedRefund(null);
                          setRefundReference('');
                        }}
                      >
                        Cancel
                      </CustomButton>
                      <CustomButton variant="primary" onClick={completeRefund} loading={isLoading}>
                        Confirm payout and post ledger
                      </CustomButton>
                    </div>
                  </div>
                )}

                {panel === 'reconcile' && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className={labelCls}>Provider / Bank Name *</label>
                        <input
                          value={provider}
                          onChange={(event) => setProvider(event.target.value)}
                          placeholder="e.g. ICICI Bank, HDFC"
                          className={inputCls}
                        />
                        <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                          The name of the banking partner or payment gateway that issued the
                          statement.
                        </p>
                      </div>
                      <div>
                        <label className={labelCls}>Statement Reference ID *</label>
                        <input
                          value={statementReference}
                          onChange={(event) => setStatementReference(event.target.value)}
                          placeholder="e.g. ST-2026-07"
                          className={inputCls}
                        />
                        <p className="text-[11px] leading-normal text-slate-600 mt-1 block">
                          A unique transaction reference for this statement batch reconciliation.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Bank statement CSV</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Required columns: `transactionReference`, `amount`, and `paidAt`.
                            Maximum 5 MB or 5,000 rows.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={downloadReconciliationTemplate}
                          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-primary  border border-slate-100"
                        >
                          <Download className="h-4 w-4" /> Download template
                        </button>
                      </div>
                      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white p-4 text-sm ring-1 ring-slate-200">
                        <span className="flex min-w-0 items-center gap-3">
                          {reconciliationImport ? (
                            <FileCheck2 className="h-5 w-5 shrink-0 text-emerald-600" />
                          ) : (
                            <Upload className="h-5 w-5 shrink-0 text-primary" />
                          )}
                          <span className="truncate">
                            {reconciliationImport
                              ? `${reconciliationImport.name} · ${reconciliationImport.rows.length.toLocaleString('en-IN')} valid rows`
                              : 'Choose completed CSV file'}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          {reconciliationImport ? 'Replace' : 'Browse'}
                        </span>
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.currentTarget.value = '';
                            if (!file) return;
                            if (file.size > MAX_RECONCILIATION_BYTES) {
                              setReconciliationImport(null);
                              setReconciliationError('Choose a CSV file no larger than 5 MB.');
                              return;
                            }
                            void file
                              .text()
                              .then((text) => {
                                const rows = parseReconciliationCsv(text);
                                setReconciliationImport({ name: file.name, rows });
                                setReconciliationError('');
                              })
                              .catch((error: Error) => {
                                setReconciliationImport(null);
                                setReconciliationError(
                                  error.message || 'The CSV file could not be read.',
                                );
                              });
                          }}
                        />
                      </label>
                      {reconciliationError && (
                        <p className="mt-2 text-xs font-medium text-red-600">
                          {reconciliationError}
                        </p>
                      )}
                      {reconciliationImport && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {reconciliationImport.rows.slice(0, 3).map((row) => (
                            <div
                              key={row.transactionReference}
                              className="rounded-lg bg-white p-3 text-xs text-slate-600 border border-slate-100"
                            >
                              <p className="truncate font-semibold text-slate-800">
                                {row.transactionReference}
                              </p>
                              <p className="mt-1">{money(row.amount)}</p>
                              <p>{new Date(row.paidAt).toLocaleDateString('en-IN')}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <CustomButton
                        variant="cancel"
                        onClick={() => {
                          setPanel(null);
                          setReconciliationImport(null);
                          setReconciliationError('');
                        }}
                      >
                        Cancel
                      </CustomButton>
                      <CustomButton
                        variant="primary"
                        onClick={submitReconciliation}
                        loading={isLoading}
                        disabled={!reconciliationImport?.rows.length}
                      >
                        Import and Match
                      </CustomButton>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${value === 'matched' || value === 'approved' || value === 'paid' || value === 'active' ? 'bg-emerald-50 text-emerald-700' : value === 'rejected' || value === 'exception' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}
    >
      {value}
    </span>
  );
}
function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <p className="text-xl font-black text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

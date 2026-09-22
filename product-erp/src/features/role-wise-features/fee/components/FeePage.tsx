'use client';

/**
 * @file FeePage.tsx
 * @description Fee records management — list, filter by status/semester/year, record payments.
 * @module features/role-wise-features/fee
 */

import FinanceWorkflowBar from '@/shared/components/FinanceWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { downloadPdfBlob, fetchPdf } from '@/shared/utils';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { ErrorMessage, Field, Form, Formik, useFormik } from 'formik';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  DollarSign,
  FileText,
  Receipt,
  ScrollText,
  Search,
  TrendingDown,
  Users,
  X,
  Layers,
  Sliders,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { IFeeRecord, IRecordPaymentDto } from '../types/Fee.types';
import AdvancedFeesTab from './AdvancedFeesTab';
import FeeInvoiceTab from './FeeInvoiceTab';
import FeeOverdueTab from './FeeOverdueTab';
import FeeStructuresTab from './FeeStructuresTab';
import FeeSummaryTab from './FeeSummaryTab';
import StudentFeeView from './StudentFeeView';

const statusColor: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700',
  Partial: 'bg-blue-50 text-blue-700',
  Paid: 'bg-secondary-50 text-secondary',
  Overdue: 'bg-red-50 text-red-600',
  Waived: 'bg-purple-50 text-purple-600',
  Refunded: 'bg-slate-100 text-slate-600',
};

const paySchema = Yup.object({
  amount: Yup.number().positive('Must be positive').required('Required'),
  paymentMode: Yup.string().required('Required'),
  bankRef: Yup.string().default(''),
  remarks: Yup.string().default(''),
});

function FeePage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('fee_management', 'view');
  const canCreate = useHasPermission('fee_management', 'create');
  const canEdit = useHasPermission('fee_management', 'edit');
  if (activeRole === 'student' || activeRole === 'parent') {
    return <StudentFeeView isParent={activeRole === 'parent'} />;
  }
  return <AdminFeeView canView={canView} canManage={canCreate || canEdit} />;
}

export default UseProtectedRoutes(FeePage, [
  'super_admin',
  'admin',
  'principal',
  'accounts_department',
  'administration_office',
  'scholarship_cell',
  'student',
  'parent',
]);

function AdminFeeView({ canView, canManage }: { canView: boolean; canManage: boolean }) {
  const searchParams = useSearchParams();
  const [adminTab, setAdminTab] = useState<
    'records' | 'structures' | 'invoice' | 'overdue' | 'summary' | 'advanced'
  >('records');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? '');
  const [filterYear, setFilterYear] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [payRecord, setPayRecord] = useState<IFeeRecord | null>(null);
  const [bonafideFor, setBonafideFor] = useState<IFeeRecord | null>(null);
  const [tcFor, setTcFor] = useState<IFeeRecord | null>(null);

  const { data: raw, isLoading, isValidating, mutate } = useSwr(canView ? 'fee/records' : null);

  const records: IFeeRecord[] = (raw as { data?: { data?: IFeeRecord[] } })?.data?.data ?? [];
  const { mutation, isLoading: paying } = useMutation();

  const total = records.length;
  const collected = records.reduce((s, r) => s + r.totalPaid, 0);
  const pending = records.reduce((s, r) => s + r.balanceDue, 0);
  const overdue = records.filter((r) => r.status === 'Overdue').length;

  const filtered = records.filter((r) => {
    const matchesStatus = !filterStatus || r.status === filterStatus;
    const matchesYear = !filterYear || r.academicYear === filterYear;
    const matchesSem = !filterSem || String(r.semester) === filterSem;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (r.studentName ?? '').toLowerCase().includes(q) ||
      (r.rollNumber ?? '').toLowerCase().includes(q) ||
      (r.invoiceNumber ?? '').toLowerCase().includes(q);

    return matchesStatus && matchesYear && matchesSem && matchesSearch;
  });

  const columns: Column<IFeeRecord>[] = [
    { field: 'invoiceNumber', title: 'Invoice #', sortable: true },
    { field: 'rollNumber', title: 'Roll No' },
    { field: 'studentName', title: 'Student' },
    { field: 'program', title: 'Program/Sem', render: (r) => `${r.program} - Sem ${r.semester}` },
    { field: 'netDue', title: 'Net Due', render: (r) => `₹${r.netDue.toLocaleString()}` },
    { field: 'totalPaid', title: 'Paid', render: (r) => `₹${r.totalPaid.toLocaleString()}` },
    { field: 'balanceDue', title: 'Balance', render: (r) => `₹${r.balanceDue.toLocaleString()}` },
    {
      field: 'status',
      title: 'Status',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] ?? 'bg-gray-100'}`}
        >
          {r.status}
        </span>
      ),
    },
    { field: 'dueDate', title: 'Due Date', render: (r) => r.dueDate?.slice(0, 10) },
  ];

  const actions: Action<IFeeRecord>[] = canManage
    ? [
        {
          icon: <DollarSign size={15} />,
          tooltip: 'Record Payment',
          onClick: (row) => setPayRecord(row),
          hidden: (row) => row.status === 'Paid' || row.status === 'Waived',
        },
        {
          icon: <FileText size={15} />,
          tooltip: 'Issue Bonafide',
          onClick: (row) => setBonafideFor(row),
        },
        {
          icon: <ScrollText size={15} />,
          tooltip: 'Issue TC',
          onClick: (row) => setTcFor(row),
        },
      ]
    : [];

  const handlePayment = async (values: IRecordPaymentDto) => {
    if (!payRecord) return;
    const r = await mutation(`fee/${payRecord._id}/payment`, { method: 'POST', body: values });
    if ((r as { data?: { success?: boolean } })?.data?.success) {
      toast.success('Payment recorded');
      mutate();
      setPayRecord(null);
    }
  };

  const stats = [
    {
      label: 'Total Records',
      value: total,
      icon: <Users className="h-4.5 w-4.5" />,
      color: 'bg-primary-50 text-primary',
    },
    {
      label: 'Collected',
      value: `₹${collected.toLocaleString()}`,
      icon: <DollarSign className="h-4.5 w-4.5" />,
      color: 'bg-secondary-50 text-secondary',
    },
    {
      label: 'Pending Balance',
      value: `₹${pending.toLocaleString()}`,
      icon: <TrendingDown className="h-4.5 w-4.5" />,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Overdue',
      value: overdue,
      icon: <AlertCircle className="h-4.5 w-4.5" />,
      color: 'bg-red-50 text-red-500',
    },
  ];

  if (!canView) {
    return (
      <Empty
        title="Fee management access unavailable"
        subTitle="Your active role does not have permission to view institutional fee records."
      />
    );
  }

  return (
    <div className="space-y-5 p-2 mb-10">
      <FinanceWorkflowBar />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Student fee records, payments and collections
          </p>
        </div>
        <Receipt className="h-7 w-7 text-primary opacity-80" />
      </motion.div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-white p-2 border border-slate-100">
        {(
          [
            { key: 'records', label: 'Records', icon: <FileText className="h-4.5 w-4.5" /> },
            ...(canManage
              ? [
                  {
                    key: 'structures' as const,
                    label: 'Structures',
                    icon: <Layers className="h-4.5 w-4.5" />,
                  },
                  {
                    key: 'invoice' as const,
                    label: 'Generate Invoice',
                    icon: <Receipt className="h-4.5 w-4.5" />,
                  },
                ]
              : []),
            { key: 'overdue', label: 'Overdue', icon: <AlertCircle className="h-4.5 w-4.5" /> },
            { key: 'summary', label: 'Summary', icon: <TrendingDown className="h-4.5 w-4.5" /> },
            ...(canManage
              ? [
                  {
                    key: 'advanced' as const,
                    label: 'Advanced Fees',
                    icon: <Sliders className="h-4.5 w-4.5" />,
                  },
                ]
              : []),
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setAdminTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer ${
              adminTab === t.key
                ? 'bg-primary text-white '
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {adminTab === 'structures' && <FeeStructuresTab />}
      {adminTab === 'invoice' && <FeeInvoiceTab />}
      {adminTab === 'overdue' && <FeeOverdueTab />}
      {adminTab === 'summary' && <FeeSummaryTab />}
      {adminTab === 'advanced' && <AdvancedFeesTab />}

      {adminTab === 'records' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s, i) => (
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
                  <p className="text-xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Filters + Searchbar on right side */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                {['Pending', 'Partial', 'Paid', 'Overdue', 'Waived', 'Refunded'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <div className="w-40">
                <AsyncSelect
                  type="semesters"
                  value={filterSem || null}
                  onChange={(value) => setFilterSem(value ?? '')}
                  placeholder="All semesters"
                />
              </div>
              <div className="w-48">
                <AsyncSelect
                  type="academicYears"
                  value={filterYear || null}
                  onChange={(value) => setFilterYear(value ?? '')}
                  placeholder="All academic years"
                />
              </div>
            </div>

            {/* Searchbar on right side of filter section */}
            <div className="relative w-full sm:w-80 md:w-96">
              <input
                type="text"
                placeholder="Search student, roll no, invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/90 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            </div>
          </div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="rounded-2xl bg-white overflow-hidden"
          >
            <CustomTable
              title="Student Fee Records"
              subtitle="View, track and process student fee payments and invoices across academic years"
              data={filtered}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              isValidating={isValidating}
              onRefresh={() => void mutate()}
              options={{
                toolbar: true,
                search: false,
                refresh: true,
                export: false,
                pagination: true,
                pageSize: 10,
              }}
            />
          </motion.div>
        </>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {payRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPayRecord(null)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-2xl bg-white"
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Record Payment</h2>
                  <p className="text-xs text-slate-600">Invoice: {payRecord.invoiceNumber}</p>
                </div>
                <button
                  onClick={() => setPayRecord(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="px-6 py-3 bg-amber-50 text-amber-700 text-sm font-medium">
                Balance Due: ₹{payRecord.balanceDue.toLocaleString()}
              </div>
              <Formik
                initialValues={{
                  amount: payRecord.balanceDue,
                  paymentMode: '' as IRecordPaymentDto['paymentMode'],
                  bankRef: '',
                  remarks: '',
                }}
                validationSchema={paySchema}
                onSubmit={handlePayment}
              >
                {() => (
                  <Form className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">
                          Amount *
                        </label>
                        <Field
                          type="number"
                          name="amount"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <ErrorMessage name="amount">
                          {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                        </ErrorMessage>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">
                          Payment Mode *
                        </label>
                        <Field
                          as="select"
                          name="paymentMode"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">Select</option>
                          {[
                            'Cash',
                            'DD',
                            'NEFT',
                            'RTGS',
                            'UPI',
                            'Net Banking',
                            'Card',
                            'Cheque',
                            'Online Portal',
                          ].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </Field>
                        <ErrorMessage name="paymentMode">
                          {(m) => <p className="mt-1 text-xs text-red-500">{m}</p>}
                        </ErrorMessage>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Bank Reference
                      </label>
                      <Field
                        name="bankRef"
                        placeholder="UTR / Cheque No."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Remarks
                      </label>
                      <Field
                        name="remarks"
                        placeholder="Optional notes"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                      <CustomButton
                        variant="cancel"
                        onClick={() => setPayRecord(null)}
                        type="button"
                      >
                        Cancel
                      </CustomButton>
                      <CustomButton type="submit" loading={paying} loadingText="Recording…">
                        Record Payment
                      </CustomButton>
                    </div>
                  </Form>
                )}
              </Formik>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bonafideFor && <BonafideModal record={bonafideFor} onClose={() => setBonafideFor(null)} />}
        {tcFor && <TCModal record={tcFor} onClose={() => setTcFor(null)} />}
      </AnimatePresence>
    </div>
  );
}

const postForPdf = (path: string, body: Record<string, unknown>) =>
  fetchPdf(path, { method: 'POST', body });

function BonafideModal({ record, onClose }: { record: IFeeRecord; onClose: () => void }) {
  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white';
  const labelCls = 'mb-1 block text-xs font-medium text-slate-600';
  const [busy, setBusy] = useState(false);
  const formik = useFormik({
    initialValues: {
      studentName: record.studentName,
      fatherName: '',
      rollNumber: record.rollNumber,
      program: record.program,
      branch: record.branch,
      semester: record.semester,
      academicYear: record.academicYear,
      dateOfAdmission: '',
      purpose: 'Bank Loan',
      issuedBy: 'Principal',
      designation: 'Principal',
    },
    validationSchema: Yup.object({
      fatherName: Yup.string().required('Required'),
      dateOfAdmission: Yup.string().required('Required'),
      purpose: Yup.string().required('Required'),
      issuedBy: Yup.string().required('Required'),
      designation: Yup.string().required('Required'),
    }),
    onSubmit: async (values) => {
      setBusy(true);
      const blob = await postForPdf(`fee/bonafide/${record.studentId}`, values);
      setBusy(false);
      if (!blob) {
        toast.error('Failed to generate bonafide');
        return;
      }
      downloadPdfBlob(blob, `bonafide-${record.rollNumber}.pdf`);
      toast.success('Bonafide downloaded');
      onClose();
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Issue Bonafide Certificate</h2>
            <p className="text-xs text-slate-600">
              {record.studentName} · {record.rollNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Father&apos;s Name *</label>
              <input className={inputCls} {...formik.getFieldProps('fatherName')} />
              {formik.touched.fatherName && formik.errors.fatherName && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.fatherName}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Date of Admission *</label>
              <input
                type="date"
                className={inputCls}
                {...formik.getFieldProps('dateOfAdmission')}
              />
              {formik.touched.dateOfAdmission && formik.errors.dateOfAdmission && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.dateOfAdmission}</p>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Purpose *</label>
            <input className={inputCls} {...formik.getFieldProps('purpose')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Issued By *</label>
              <input className={inputCls} {...formik.getFieldProps('issuedBy')} />
            </div>
            <div>
              <label className={labelCls}>Designation *</label>
              <input className={inputCls} {...formik.getFieldProps('designation')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={busy} startIcon={<FileText className="h-4 w-4" />}>
              Generate PDF
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TCModal({ record, onClose }: { record: IFeeRecord; onClose: () => void }) {
  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white';
  const labelCls = 'mb-1 block text-xs font-medium text-slate-600';
  const [busy, setBusy] = useState(false);
  const formik = useFormik({
    initialValues: {
      studentName: record.studentName,
      fatherName: '',
      motherName: '',
      rollNumber: record.rollNumber,
      enrollmentNumber: record.rollNumber,
      program: record.program,
      branch: record.branch,
      dateOfAdmission: '',
      dateOfLeaving: new Date().toISOString().slice(0, 10),
      semesterCompleted: record.semester,
      cgpa: 0,
      conductCharacter: 'Good',
      reasonForLeaving: '',
      issuedBy: 'Principal',
    },
    validationSchema: Yup.object({
      fatherName: Yup.string().required('Required'),
      motherName: Yup.string().required('Required'),
      dateOfAdmission: Yup.string().required('Required'),
      dateOfLeaving: Yup.string().required('Required'),
      cgpa: Yup.number().min(0).max(10).required('Required'),
      reasonForLeaving: Yup.string().required('Required'),
      issuedBy: Yup.string().required('Required'),
    }),
    onSubmit: async (values) => {
      setBusy(true);
      const blob = await postForPdf(`fee/tc/${record.studentId}`, values);
      setBusy(false);
      if (!blob) {
        toast.error('Failed to generate TC');
        return;
      }
      downloadPdfBlob(blob, `tc-${record.rollNumber}.pdf`);
      toast.success('TC downloaded');
      onClose();
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-xl rounded-2xl bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Issue Transfer Certificate</h2>
            <p className="text-xs text-slate-600">
              {record.studentName} · {record.rollNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Father&apos;s Name *</label>
              <input className={inputCls} {...formik.getFieldProps('fatherName')} />
              {formik.touched.fatherName && formik.errors.fatherName && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.fatherName}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Mother&apos;s Name *</label>
              <input className={inputCls} {...formik.getFieldProps('motherName')} />
              {formik.touched.motherName && formik.errors.motherName && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.motherName}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Date of Admission *</label>
              <input
                type="date"
                className={inputCls}
                {...formik.getFieldProps('dateOfAdmission')}
              />
              {formik.touched.dateOfAdmission && formik.errors.dateOfAdmission && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.dateOfAdmission}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Date of Leaving *</label>
              <input type="date" className={inputCls} {...formik.getFieldProps('dateOfLeaving')} />
            </div>
            <div>
              <label className={labelCls}>CGPA *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={10}
                className={inputCls}
                {...formik.getFieldProps('cgpa')}
              />
              {formik.touched.cgpa && formik.errors.cgpa && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.cgpa}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Conduct / Character</label>
              <select className={inputCls} {...formik.getFieldProps('conductCharacter')}>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Satisfactory">Satisfactory</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Reason for Leaving *</label>
            <input className={inputCls} {...formik.getFieldProps('reasonForLeaving')} />
            {formik.touched.reasonForLeaving && formik.errors.reasonForLeaving && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.reasonForLeaving}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Issued By *</label>
            <input className={inputCls} {...formik.getFieldProps('issuedBy')} />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              type="submit"
              loading={busy}
              startIcon={<ScrollText className="h-4 w-4" />}
            >
              Generate TC
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

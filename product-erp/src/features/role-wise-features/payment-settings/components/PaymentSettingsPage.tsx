/**
 * @file PaymentSettingsPage.tsx
 * @description Payment Settings — Super Admin only:
 *   View all settings (GET payment-settings/)
 *   Create / update settings (POST payment-settings/) — institutionName, UPI, bankAccounts[], acceptedModes, requireScreenshot, requireUtrNumber, maxVerificationDays, paymentInstructions
 *   Activate a settings record (PUT payment-settings/:id/activate)
 *   Active settings view (GET payment-settings/active) — shown to Accounts / Principal too
 * @module features/role-wise-features/payment-settings
 */
'use client';

import FinanceWorkflowBar from '@/shared/components/FinanceWorkflowBar';
import CustomButton from '@/shared/core/CustomButton';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { FieldArray, FormikProvider, useFormik } from 'formik';
import {
  Building,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import * as Yup from 'yup';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface IBankAccount {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  accountType: 'savings' | 'current';
}

interface IPaymentSettings {
  _id: string;
  institutionName: string;
  isActive?: boolean;
  qrCodeUrl?: string;
  upiId?: string;
  upiName?: string;
  bankAccounts: IBankAccount[];
  paymentInstructions?: string;
  acceptedModes: string[];
  requireScreenshot: boolean;
  requireUtrNumber: boolean;
  maxVerificationDays: number;
  updatedAt?: string;
  [key: string]: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const ALL_MODES = ['upi', 'neft', 'rtgs', 'imps', 'cheque', 'dd', 'cash', 'card'];

const BLANK_BANK: IBankAccount = {
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
  accountType: 'current',
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maskAccount(n: string) {
  if (!n || n.length < 5) return '••••';
  return '•'.repeat(n.length - 4) + n.slice(-4);
}

// ─── Settings Form ─────────────────────────────────────────────────────────────

interface SettingsFormProps {
  initial?: IPaymentSettings | null;
  onSaved: () => void;
}

function SettingsForm({ initial, onSaved }: SettingsFormProps) {
  const { mutation, isLoading } = useMutation();
  const [showAccNos, setShowAccNos] = useState<Record<number, boolean>>({});

  const formik = useFormik<{
    institutionName: string;
    upiId: string;
    upiName: string;
    bankAccounts: IBankAccount[];
    acceptedModes: string[];
    paymentInstructions: string;
    requireScreenshot: boolean;
    requireUtrNumber: boolean;
    maxVerificationDays: number;
  }>({
    initialValues: {
      institutionName: initial?.institutionName ?? '',
      upiId: initial?.upiId ?? '',
      upiName: initial?.upiName ?? '',
      bankAccounts: initial?.bankAccounts?.length ? initial.bankAccounts : [{ ...BLANK_BANK }],
      acceptedModes: initial?.acceptedModes ?? ['upi', 'neft', 'rtgs', 'imps'],
      paymentInstructions: initial?.paymentInstructions ?? '',
      requireScreenshot: initial?.requireScreenshot ?? true,
      requireUtrNumber: initial?.requireUtrNumber ?? true,
      maxVerificationDays: initial?.maxVerificationDays ?? 3,
    },
    validationSchema: Yup.object({
      institutionName: Yup.string().trim().required('Institution name required'),
      upiId: Yup.string().trim(),
      bankAccounts: Yup.array().of(
        Yup.object({
          bankName: Yup.string().trim().required('Bank name required'),
          accountHolderName: Yup.string().trim().required('Account holder required'),
          accountNumber: Yup.string().trim().required('Account number required'),
          ifscCode: Yup.string()
            .trim()
            .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code')
            .required('IFSC code required'),
        }),
      ),
      maxVerificationDays: Yup.number().min(1).max(30).required(),
    }),
    onSubmit: async (values) => {
      const res = await mutation('payment-settings', {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if (
        (res as { success?: boolean })?.success ||
        (res as { results?: { success?: boolean } })?.results?.success
      ) {
        toast.success('Payment settings saved');
        onSaved();
      } else {
        toast.error('Failed to save settings');
      }
    },
  });

  const toggleMode = (mode: string) => {
    const cur = formik.values.acceptedModes;
    formik.setFieldValue(
      'acceptedModes',
      cur.includes(mode) ? cur.filter((m) => m !== mode) : [...cur, mode],
    );
  };

  const banks = formik.values.bankAccounts;
  const bankErrors = (formik.errors.bankAccounts as Record<string, string>[] | undefined) ?? [];
  const bankTouched = (formik.touched.bankAccounts as Record<string, boolean>[] | undefined) ?? [];

  return (
    <FormikProvider value={formik}>
      <form onSubmit={formik.handleSubmit} className="space-y-6">
        {/* Institution */}
        <div className="rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800">Institution Details</h3>
          </div>
          <div>
            <label className={labelCls}>Institution Name *</label>
            <input
              name="institutionName"
              value={formik.values.institutionName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="Enter institution name"
              className={inputCls}
            />
            {formik.touched.institutionName && formik.errors.institutionName && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.institutionName}</p>
            )}
          </div>
        </div>

        {/* UPI */}
        <div className="rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800">UPI Details</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>UPI ID</label>
              <input
                name="upiId"
                value={formik.values.upiId}
                onChange={formik.handleChange}
                placeholder="college@sbi"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>UPI Display Name</label>
              <input
                name="upiName"
                value={formik.values.upiName}
                onChange={formik.handleChange}
                placeholder="Enter account holder name"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Bank Accounts */}
        <div className="rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-slate-800">Bank Accounts</h3>
            </div>
            <CustomButton
              type="button"
              variant="tertiary"
              className="w-fit! py-1.5! text-xs!"
              onClick={() => formik.setFieldValue('bankAccounts', [...banks, { ...BLANK_BANK }])}
              startIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Account
            </CustomButton>
          </div>

          <FieldArray name="bankAccounts">
            {() => (
              <div className="space-y-4">
                {banks.map((bank, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500">Account {i + 1}</p>
                      {banks.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            formik.setFieldValue(
                              'bankAccounts',
                              banks.filter((_, j) => j !== i),
                            )
                          }
                          className="text-slate-300 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        {
                          name: 'bankName',
                          label: 'Bank Name',
                          placeholder: 'State Bank of India',
                        },
                        {
                          name: 'accountHolderName',
                          label: 'Account Holder Name',
                          placeholder: 'Enter account holder name',
                        },
                        { name: 'ifscCode', label: 'IFSC Code', placeholder: 'SBIN0001234' },
                        { name: 'branchName', label: 'Branch', placeholder: 'Main Branch, City' },
                      ].map((f) => (
                        <div key={f.name}>
                          <label className={labelCls}>
                            {f.label}
                            {['bankName', 'accountHolderName', 'ifscCode'].includes(f.name)
                              ? ' *'
                              : ''}
                          </label>
                          <input
                            name={`bankAccounts.${i}.${f.name}`}
                            value={(bank as unknown as Record<string, string>)[f.name] ?? ''}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            placeholder={f.placeholder}
                            className={f.name === 'ifscCode' ? inputCls + ' uppercase' : inputCls}
                          />
                          {bankTouched[i]?.[f.name] && bankErrors[i]?.[f.name] && (
                            <p className="mt-1 text-xs text-red-500">{bankErrors[i][f.name]}</p>
                          )}
                        </div>
                      ))}
                      {/* Account Number with show/hide */}
                      <div>
                        <label className={labelCls}>Account Number *</label>
                        <div className="relative">
                          <input
                            type={showAccNos[i] ? 'text' : 'password'}
                            name={`bankAccounts.${i}.accountNumber`}
                            value={bank.accountNumber}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            placeholder="Enter account number"
                            className={inputCls + ' pr-10'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAccNos((p) => ({ ...p, [i]: !p[i] }))}
                            className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-600"
                          >
                            {showAccNos[i] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {bankTouched[i]?.accountNumber && bankErrors[i]?.accountNumber && (
                          <p className="mt-1 text-xs text-red-500">{bankErrors[i].accountNumber}</p>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Account Type</label>
                        <select
                          name={`bankAccounts.${i}.accountType`}
                          value={bank.accountType}
                          onChange={formik.handleChange}
                          className={inputCls}
                        >
                          <option value="current">Current</option>
                          <option value="savings">Savings</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FieldArray>
        </div>

        {/* Payment Modes */}
        <div className="rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800">Accepted Payment Modes</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => toggleMode(mode)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  formik.values.acceptedModes.includes(mode)
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Verification Settings */}
        <div className="rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800">Verification Requirements</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Require Payment Screenshot</p>
                <p className="text-xs text-slate-600">Students must upload proof of payment</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  formik.setFieldValue('requireScreenshot', !formik.values.requireScreenshot)
                }
                className={`relative h-6 w-11 rounded-full transition-colors ${formik.values.requireScreenshot ? 'bg-primary' : 'bg-slate-200'}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${formik.values.requireScreenshot ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Require UTR / Transaction Number</p>
                <p className="text-xs text-slate-600">Students must enter UTR or transaction ID</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  formik.setFieldValue('requireUtrNumber', !formik.values.requireUtrNumber)
                }
                className={`relative h-6 w-11 rounded-full transition-colors ${formik.values.requireUtrNumber ? 'bg-primary' : 'bg-slate-200'}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${formik.values.requireUtrNumber ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Max Verification SLA (days)</p>
                <p className="text-xs text-slate-600">
                  Accounts team must verify within this many days
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    formik.setFieldValue(
                      'maxVerificationDays',
                      Math.max(1, formik.values.maxVerificationDays - 1),
                    )
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 text-sm font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold">
                  {formik.values.maxVerificationDays}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    formik.setFieldValue(
                      'maxVerificationDays',
                      Math.min(30, formik.values.maxVerificationDays + 1),
                    )
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 text-sm font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Instructions */}
        <div className="rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800">
              Payment Instructions for Students
            </h3>
          </div>
          <textarea
            name="paymentInstructions"
            rows={5}
            value={formik.values.paymentInstructions}
            onChange={formik.handleChange}
            placeholder="Step-by-step instructions shown to students when paying fees. Markdown supported."
            className={inputCls + ' resize-none'}
          />
        </div>

        <div className="flex justify-end">
          <CustomButton
            variant="primary"
            type="submit"
            loading={isLoading}
            startIcon={<Settings className="h-4 w-4" />}
            className="w-fit!"
          >
            Save Payment Settings
          </CustomButton>
        </div>
      </form>
    </FormikProvider>
  );
}

// ─── Settings Record Card ──────────────────────────────────────────────────────

function SettingsCard({
  record,
  onActivate,
  onEdit,
  onQrUploaded,
}: {
  record: IPaymentSettings;
  onActivate: (id: string) => void;
  onEdit: (r: IPaymentSettings) => void;
  onQrUploaded: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { mutation } = useMutation();

  const handleQrUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('qrCode', file);
      const res = await mutation(`payment-settings/${record._id}/qr`, {
        method: 'POST',
        body: fd,
        isFormData: true,
      });
      const json = (
        res as { results?: { success?: boolean; error?: { message?: string } } } | undefined
      )?.results;
      if (res && json?.success !== false) {
        toast.success('QR code uploaded');
        onQrUploaded();
      } else if (res) {
        toast.error(json?.error?.message ?? 'Failed to upload QR');
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className={`rounded-2xl bg-white ${record.isActive ? 'ring-2 ring-primary/30' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((e) => !e);
          }
        }}
        className="flex w-full items-center justify-between p-5 text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {record.isActive && (
            <span className="rounded-lg bg-green-50 px-2 py-0.5 text-xs font-bold text-green-600">
              Active
            </span>
          )}
          <div>
            <p className="text-sm font-semibold">{record.institutionName}</p>
            <p className="text-xs text-slate-600">Updated {fmtDate(record.updatedAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!record.isActive && (
            <CustomButton
              variant="primary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onActivate(record._id);
              }}
              className="py-1.5! text-xs! w-fit!"
              startIcon={<CheckCircle className="h-3.5 w-3.5" />}
            >
              Activate
            </CustomButton>
          )}
          <CustomButton
            variant="tertiary"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(record);
            }}
            className="py-1.5! text-xs! w-fit!"
            startIcon={<Edit2 className="h-3.5 w-3.5" />}
          >
            Edit
          </CustomButton>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-300" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-300" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-50 px-5 pb-5"
          >
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* UPI */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                  UPI
                </p>
                <p className="text-sm text-slate-700">{record.upiId ?? '—'}</p>
                {record.upiName && <p className="text-xs text-slate-600">{record.upiName}</p>}
                {record.qrCodeUrl && (
                  <Image
                    src={record.qrCodeUrl}
                    alt="QR"
                    width={96}
                    height={96}
                    className="mt-2 h-24 w-24 rounded-lg object-contain"
                  />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleQrUpload(f);
                  }}
                />
                <CustomButton
                  type="button"
                  variant="tertiary"
                  loading={uploading}
                  startIcon={<Upload className="h-3.5 w-3.5" />}
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 py-1.5! text-xs! w-fit!"
                >
                  {record.qrCodeUrl ? 'Replace QR' : 'Upload QR'}
                </CustomButton>
              </div>
              {/* Bank Accounts */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                  Bank Accounts ({record.bankAccounts.length})
                </p>
                <div className="space-y-2">
                  {record.bankAccounts.map((b, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 p-3 text-xs">
                      <p className="font-medium">{b.bankName}</p>
                      <p className="text-slate-600 font-mono">
                        {maskAccount(b.accountNumber)} · {b.ifscCode}
                      </p>
                      <p className="text-slate-500 capitalize">
                        {b.accountType} · {b.accountHolderName}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Modes */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                  Accepted Modes
                </p>
                <div className="flex flex-wrap gap-1">
                  {record.acceptedModes.map((m) => (
                    <span
                      key={m}
                      className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium uppercase text-primary"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              {/* Verification */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                  Verification
                </p>
                <div className="space-y-1 text-xs">
                  <p className="text-slate-600">
                    Screenshot required:{' '}
                    <span className="font-medium">{record.requireScreenshot ? 'Yes' : 'No'}</span>
                  </p>
                  <p className="text-slate-600">
                    UTR required:{' '}
                    <span className="font-medium">{record.requireUtrNumber ? 'Yes' : 'No'}</span>
                  </p>
                  <p className="text-slate-600">
                    Verification SLA:{' '}
                    <span className="font-medium">{record.maxVerificationDays} day(s)</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Active Settings Read-Only View (non-superadmin) ──────────────────────────

function ActiveSettingsView() {
  const { data: raw, isLoading } = useSwr('payment-settings/active');
  const s: IPaymentSettings | undefined = (raw as { data?: IPaymentSettings })?.data;

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-white" />;
  if (!s)
    return (
      <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-600">
        No active payment settings configured
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold">{s.institutionName} — Payment Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {s.upiId && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">UPI</p>
              <p className="text-sm font-mono font-medium text-slate-800">{s.upiId}</p>
              {s.upiName && <p className="text-xs text-slate-600">{s.upiName}</p>}
              {s.qrCodeUrl && (
                <Image
                  src={s.qrCodeUrl}
                  alt="QR Code"
                  width={128}
                  height={128}
                  className="mt-3 h-32 w-32 rounded-xl object-contain"
                />
              )}
            </div>
          )}
          {s.bankAccounts.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                Bank Transfer
              </p>
              {s.bankAccounts.map((b, i) => (
                <div key={i} className="mb-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">{b.bankName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Account: <span className="font-mono">{maskAccount(b.accountNumber)}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    IFSC: <span className="font-mono">{b.ifscCode}</span>
                  </p>
                  <p className="text-xs text-slate-500">Holder: {b.accountHolderName}</p>
                  {b.branchName && <p className="text-xs text-slate-500">Branch: {b.branchName}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        {s.acceptedModes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
              Accepted Modes
            </p>
            <div className="flex flex-wrap gap-1">
              {s.acceptedModes.map((m) => (
                <span
                  key={m}
                  className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium uppercase text-primary"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {s.paymentInstructions && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
              Instructions
            </p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {s.paymentInstructions}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'active' | 'manage' | 'new';

export default function PaymentSettingsPage() {
  const isSuperAdmin = useHasPermission('accounts', 'edit');
  const canViewAdmin = useHasPermission('accounts', 'view');

  const { data: raw, isLoading, mutate } = useSwr(isSuperAdmin ? 'payment-settings' : null);
  const allSettings: IPaymentSettings[] = (raw as { data?: IPaymentSettings[] })?.data ?? [];
  const { mutation } = useMutation();

  const [active, setActive] = useState<Tab>(isSuperAdmin ? 'manage' : 'active');
  const [editing, setEditing] = useState<IPaymentSettings | null>(null);

  const handleActivate = async (id: string) => {
    const r = await Swal.fire({
      title: 'Activate this settings record?',
      text: 'The current active record will be deactivated.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Activate',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`payment-settings/${id}/activate`, { method: 'PUT', body: {} });
    if (
      (res as { success?: boolean })?.success ||
      (res as { results?: { success?: boolean } })?.results?.success
    ) {
      toast.success('Settings activated');
      mutate();
    } else toast.error('Failed');
  };

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'active', label: 'Active Settings', show: canViewAdmin },
    { id: 'manage', label: 'Manage Records', show: isSuperAdmin },
    { id: 'new', label: editing ? 'Edit Record' : 'New / Update', show: isSuperAdmin },
  ];

  return (
    <div className="space-y-5">
      <FinanceWorkflowBar />
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Payment Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {isSuperAdmin
            ? 'Configure institution-wide payment gateway details, bank accounts, and verification rules'
            : 'View active payment details for fee collection'}
        </p>
      </motion.div>

      {tabs.filter((t) => t.show).length > 1 && (
        <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1.5">
          {tabs
            .filter((t) => t.show)
            .map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active === tab.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {active === 'active' && <ActiveSettingsView />}

          {active === 'manage' && (
            <div className="space-y-3">
              {isLoading ? (
                [1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />
                ))
              ) : allSettings.length ? (
                allSettings.map((r) => (
                  <SettingsCard
                    key={r._id}
                    record={r}
                    onActivate={handleActivate}
                    onEdit={(r) => {
                      setEditing(r);
                      setActive('new');
                    }}
                    onQrUploaded={mutate}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-12">
                  <CreditCard className="h-10 w-10 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-600">No payment settings created yet</p>
                  <CustomButton
                    variant="primary"
                    onClick={() => {
                      setEditing(null);
                      setActive('new');
                    }}
                    className="mt-4 w-fit!"
                    startIcon={<Plus className="h-4 w-4" />}
                  >
                    Create Settings
                  </CustomButton>
                </div>
              )}
            </div>
          )}

          {active === 'new' && (
            <SettingsForm
              initial={editing}
              onSaved={() => {
                mutate();
                setEditing(null);
                setActive('manage');
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

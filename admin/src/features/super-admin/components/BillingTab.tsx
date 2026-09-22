/** @file BillingTab.tsx @description SaaS payment operations and reconciliation view. */
'use client';

import Image from 'next/image';
import { useDeferredValue, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  CircleAlert,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  ExternalLink,
  IndianRupee,
  Landmark,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Settings2,
  TicketPercent,
  X,
} from 'lucide-react';
import { IPlatformBillingRecord, ITenant } from '../types/super-admin.types';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import Drawer from '@mui/material/Drawer';
import FileViewer, { type IViewerFile } from '@/shared/core/FileViewer';
import { BASE_URL, getFromLocalStorage } from '@/shared/utils';

const BANKS = [
  { name: 'State Bank of India', logo: '/bank-logos/sbi.ico' },
  { name: 'HDFC Bank', logo: '/bank-logos/hdfc.png' },
  { name: 'ICICI Bank', logo: '/bank-logos/icici.ico' },
  { name: 'Axis Bank', logo: '/bank-logos/axis.ico' },
  { name: 'Kotak Mahindra Bank', logo: '/bank-logos/kotak.ico' },
  { name: 'Bank of Baroda', logo: '/bank-logos/bob.png' },
  { name: 'Punjab National Bank', logo: '/bank-logos/pnb.ico' },
  { name: 'Canara Bank', logo: '/bank-logos/canara.png' },
] as const;

const money = (paise = 0) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
const timestamp = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
const tenantLabel = (record: IPlatformBillingRecord) =>
  !record.tenantId
    ? 'Deleted tenant'
    : typeof record.tenantId === 'string'
      ? record.tenantId
      : record.tenantId.name || record.tenantId.tenantId || 'Unknown tenant';
const planLabel = (record: IPlatformBillingRecord) =>
  !record.planId
    ? 'Deleted plan'
    : typeof record.planId === 'string'
      ? record.planId
      : record.planId.name || record.planId.slug || 'Unknown plan';

const statusStyle: Record<IPlatformBillingRecord['status'], string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  refunded: 'bg-amber-50 text-amber-700',
  created: 'bg-blue-50 text-blue-700',
  submitted: 'bg-violet-50 text-violet-700',
  rejected: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

export default function BillingTab() {
  const [status, setStatus] = useState<'all' | IPlatformBillingRecord['status']>('all');
  const [paymentMethod, setPaymentMethod] = useState<'all' | 'bank_transfer'>('all');
  const [agreementStatus, setAgreementStatus] = useState<'all' | 'accepted' | 'missing'>('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const [page, setPage] = useState(1);
  const limit = 20;
  const recordsQuery = useSwr<{
    success: boolean;
    data?: IPlatformBillingRecord[];
    pagination?: { page: number; limit: number; total: number; pages: number };
    summary?: {
      collectedInPaise: number;
      refundedInPaise: number;
      successful: number;
      failed: number;
    };
  }>(
    `super-admin/billing/records?page=${page}&limit=${limit}&status=${status}&paymentMethod=${paymentMethod}&agreementStatus=${agreementStatus}&q=${encodeURIComponent(deferredQuery)}`,
    { keepPreviousData: true },
  );
  const records = recordsQuery.data?.data ?? [];
  const pagination = recordsQuery.data?.pagination ?? { page, limit, total: 0, pages: 1 };
  const summary = recordsQuery.data?.summary;
  const isLoading = recordsQuery.isLoading;
  const error = recordsQuery.error;
  const refresh = recordsQuery.mutate;
  const coupons = useSwr<{
    success: boolean;
    data?: Array<{
      _id: string;
      code: string;
      description?: string;
      discountType: 'percentage' | 'fixed';
      discountValue: number;
      assignedEmail?: string;
      assignedTenantId?: string;
      expiresAt?: string;
      maxRedemptions?: number;
      redemptionCount: number;
      isActive: boolean;
    }>;
  }>('super-admin/billing/coupons');
  const tenants = useSwr<{ success: boolean; data?: ITenant[] }>('super-admin/tenants');
  const settings = useSwr<{
    success: boolean;
    data?: {
      accountHolderName: string;
      bankName: string;
      accountNumber: string;
      ifscCode: string;
      branch?: string;
      upiId?: string;
      instructions?: string;
      legalName?: string;
      gstin?: string;
      state?: string;
      taxRatePercent?: number;
      authorizedSignatoryName?: string;
      isEnabled: boolean;
    };
  }>('super-admin/billing/settings');
  const { mutation, isLoading: isSaving } = useMutation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState('Other bank');
  const [customBankName, setCustomBankName] = useState('');
  const [billingEnabled, setBillingEnabled] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const reviewInFlight = useRef(new Set<string>());
  const [viewerFile, setViewerFile] = useState<IViewerFile | null>(null);
  const [agreementLoading, setAgreementLoading] = useState<'nda' | 'terms' | null>(null);
  const [agreementError, setAgreementError] = useState<{
    kind: 'nda' | 'terms';
    message: string;
  } | null>(null);
  const [detailRecord, setDetailRecord] = useState<IPlatformBillingRecord | null>(null);
  const refreshRecords = async () => {
    const refreshed = (await refresh()) as
      | { data?: { data?: IPlatformBillingRecord[] } }
      | undefined;
    if (!detailRecord) return;
    const current = refreshed?.data?.data?.find((record) => record._id === detailRecord._id);
    if (current) setDetailRecord(current);
  };
  const selectDetail = (record: IPlatformBillingRecord) => {
    setAgreementError(null);
    setAgreementLoading(null);
    setDetailRecord(record);
  };
  const closeDetail = () => {
    setAgreementError(null);
    setAgreementLoading(null);
    setDetailRecord(null);
  };
  const openSettings = () => {
    const savedBank = settings.data?.data?.bankName;
    const supported = Boolean(savedBank && BANKS.some((bank) => bank.name === savedBank));
    setSelectedBank(supported ? String(savedBank) : 'Other bank');
    setCustomBankName(supported ? '' : (savedBank ?? ''));
    setBillingEnabled(settings.data?.data?.isEnabled ?? true);
    setSettingsOpen(true);
  };
  const summaries = [
    {
      label: 'Collected',
      value: money(summary?.collectedInPaise ?? 0),
      icon: IndianRupee,
      tone: 'text-emerald-600',
    },
    {
      label: 'Successful',
      value: (summary?.successful ?? 0).toLocaleString('en-IN'),
      icon: CircleCheck,
      tone: 'text-emerald-600',
    },
    {
      label: 'Failed',
      value: (summary?.failed ?? 0).toLocaleString('en-IN'),
      icon: CircleAlert,
      tone: 'text-red-600',
    },
    {
      label: 'Refunded',
      value: money(summary?.refundedInPaise ?? 0),
      icon: RotateCcw,
      tone: 'text-amber-600',
    },
  ];

  const review = async (record: IPlatformBillingRecord, decision: 'approve' | 'reject') => {
    if (reviewInFlight.current.has(record._id)) return;
    reviewInFlight.current.add(record._id);
    const dialog = await Swal.fire({
      title:
        decision === 'approve'
          ? record.amountInPaise === 0
            ? 'Approve free-tier workspace'
            : 'Approve subscription payment'
          : record.amountInPaise === 0
            ? 'Reject free-tier registration'
            : 'Reject payment submission',
      text:
        decision === 'approve'
          ? record.amountInPaise === 0
            ? `Confirm the NDA-verified free-tier registration for ${tenantLabel(record)}. Provisioning will start after approval.`
            : `Confirm the verified payment for ${tenantLabel(record)}.`
          : `Explain why the payment from ${tenantLabel(record)} cannot be approved.`,
      input: 'textarea',
      inputLabel: decision === 'approve' ? 'Approval note (optional)' : 'Rejection reason',
      inputPlaceholder:
        decision === 'approve'
          ? 'Add an internal verification note…'
          : 'Enter a clear reason for the tenant…',
      inputAttributes: { 'aria-label': 'Payment review note', maxlength: '1000' },
      showCancelButton: true,
      confirmButtonText:
        decision === 'approve'
          ? record.amountInPaise === 0
            ? 'Approve workspace'
            : 'Approve payment'
          : 'Reject registration',
      confirmButtonColor: decision === 'approve' ? '#059669' : '#dc2626',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusCancel: decision === 'reject',
      customClass: {
        popup: 'rounded-3xl!',
        confirmButton: 'rounded-xl! px-5! py-2.5!',
        cancelButton: 'rounded-xl! px-5! py-2.5!',
        input: 'rounded-xl! border-slate-200! text-sm!',
      },
      preConfirm: (value: string) => {
        const note = String(value ?? '').trim();
        if (decision === 'reject' && note.length < 10) {
          Swal.showValidationMessage('Enter a rejection reason of at least 10 characters.');
          return false;
        }
        return note;
      },
    });
    if (!dialog.isConfirmed) {
      reviewInFlight.current.delete(record._id);
      return;
    }
    const remarks = String(dialog.value ?? '').trim();
    if (decision === 'reject' && (!remarks || remarks.length < 10)) {
      reviewInFlight.current.delete(record._id);
      return;
    }
    setReviewingId(record._id);
    try {
      const response = await mutation(`super-admin/billing/records/${record._id}/${decision}`, {
        method: 'POST',
        body: { remarks },
        isAlert: true,
        dedupe: false,
        platformContext: true,
      });
      const updated = response?.results?.data as IPlatformBillingRecord | undefined;
      if (updated) {
        setDetailRecord((current) =>
          current?._id === updated._id ? { ...current, ...updated } : current,
        );
      }
      if (response) await refreshRecords();
    } finally {
      reviewInFlight.current.delete(record._id);
      setReviewingId(null);
    }
  };

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await mutation('super-admin/billing/settings', {
      method: 'PUT',
      body: {
        accountHolderName: data.get('accountHolderName'),
        bankName: selectedBank === 'Other bank' ? customBankName : selectedBank,
        accountNumber: data.get('accountNumber'),
        ifscCode: data.get('ifscCode'),
        branch: data.get('branch'),
        upiId: data.get('upiId'),
        instructions: data.get('instructions'),
        legalName: data.get('legalName'),
        gstin: data.get('gstin'),
        state: data.get('state'),
        taxRatePercent: Number(data.get('taxRatePercent') || 0),
        authorizedSignatoryName: data.get('authorizedSignatoryName'),
        isEnabled: billingEnabled,
      },
      isAlert: true,
      dedupe: false,
      platformContext: true,
    });
    if (response) {
      await settings.mutate();
      setSettingsOpen(false);
    }
  };

  const createCoupon = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await mutation('super-admin/billing/coupons', {
      method: 'POST',
      body: {
        code: data.get('code'),
        description: data.get('description'),
        discountType: data.get('discountType'),
        discountValue: Number(data.get('discountValue')),
        assignedEmail: data.get('assignedEmail'),
        assignedTenantId: data.get('assignedTenantId'),
        expiresAt: data.get('expiresAt') || undefined,
        maxRedemptions: data.get('maxRedemptions') ? Number(data.get('maxRedemptions')) : undefined,
      },
      isAlert: true,
      dedupe: false,
      platformContext: true,
    });
    if (response) {
      form.reset();
      await coupons.mutate();
    }
  };

  const toggleCoupon = async (id: string, isActive: boolean) => {
    const response = await mutation(`super-admin/billing/coupons/${id}`, {
      method: 'PATCH',
      body: { isActive },
      isAlert: true,
      dedupe: false,
      platformContext: true,
    });
    if (response) await coupons.mutate();
  };
  const detailInvoiceUrl = detailRecord
    ? `${BASE_URL}/super-admin/billing/records/${detailRecord._id}/invoice`
    : '';
  const openInvoice = async (download: boolean) => {
    if (!detailRecord) return;
    const token = getFromLocalStorage('accessToken');
    const response = await fetch(detailInvoiceUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Platform-Context': 'true',
      },
    });
    if (!response.ok) {
      await Swal.fire('Invoice unavailable', 'The invoice PDF could not be loaded.', 'error');
      return;
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const filename = `invoice-${detailRecord.invoiceNumber}.pdf`;
    if (download) {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      return;
    }
    setViewerFile({ url: objectUrl, name: filename, mimeType: 'application/pdf' });
  };
  const openAgreement = async (kind: 'nda' | 'terms', download: boolean) => {
    if (!detailRecord) return;
    setAgreementLoading(kind);
    setAgreementError(null);
    const response = await mutation(
      `super-admin/billing/records/${detailRecord._id}/agreements/${kind}/preview`,
      {
        method: 'POST',
        body: {},
        dedupe: false,
        platformContext: true,
      },
    );
    setAgreementLoading(null);
    const payload = response?.results as
      | {
          success?: boolean;
          data?: { filename: string; mimeType: string; dataUrl: string };
          error?: { message?: string };
        }
      | undefined;
    if (!payload?.success || !payload.data?.dataUrl) {
      setAgreementError({
        kind,
        message:
          payload?.error?.message ||
          'The accepted PDF could not be generated. Check the PDF service and retry.',
      });
      return;
    }
    if (download) {
      const anchor = document.createElement('a');
      anchor.href = payload.data.dataUrl;
      anchor.download = payload.data.filename;
      anchor.click();
      return;
    }
    setViewerFile({
      url: payload.data.dataUrl,
      name: payload.data.filename,
      mimeType: payload.data.mimeType,
    });
  };

  return (
    <div className="space-y-5">
      <section className="admin-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-blue-50 p-2 text-primary">
              <Landmark className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">Platform invoice billing</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    settings.data?.data?.isEnabled
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {settings.data?.data?.isEnabled ? 'Active' : 'Not configured'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {settings.data?.data
                  ? `${settings.data.data.bankName} · account ending ${settings.data.data.accountNumber.slice(-4)}`
                  : 'Add beneficiary details before accepting paid registrations.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Settings2 className="h-4 w-4" />
            {settings.data?.data ? 'Edit billing details' : 'Configure billing'}
          </button>
        </div>
      </section>

      <section className="admin-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
              <TicketPercent className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Personalized coupons</h2>
              <p className="mt-1 text-sm text-slate-500">
                {(coupons.data?.data ?? []).filter((coupon) => coupon.isActive).length} active
                coupons · managed separately from GST.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCouponsOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            <TicketPercent className="h-4 w-4" />
            Manage coupons
          </button>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map((item) => (
          <article key={item.label} className="admin-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{item.label}</span>
              <item.icon className={`h-5 w-5 ${item.tone}`} />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{item.value}</p>
          </article>
        ))}
      </div>

      <section className="admin-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Payment activity</h2>
            <p className="text-sm text-slate-500">
              Invoice payments, proof review, activation, refunds and email delivery.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search tenant, invoice or payment"
              className="w-full rounded-xl sm:min-w-64 bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="created">Pending</option>
              <option value="submitted">Awaiting review</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={paymentMethod}
              onChange={(event) => {
                setPaymentMethod(event.target.value as typeof paymentMethod);
                setPage(1);
              }}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm"
            >
              <option value="all">All payment methods</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
            <select
              value={agreementStatus}
              onChange={(event) => {
                setAgreementStatus(event.target.value as typeof agreementStatus);
                setPage(1);
              }}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm"
            >
              <option value="all">All legal statuses</option>
              <option value="accepted">NDA + terms accepted</option>
              <option value="missing">Acceptance missing</option>
            </select>
            <button
              type="button"
              onClick={() => void refreshRecords()}
              disabled={recordsQuery.isValidating}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <RotateCcw className={`h-4 w-4 ${recordsQuery.isValidating ? 'animate-spin' : ''}`} />
              {recordsQuery.isValidating ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        {error ? (
          <div className="p-10 text-center text-red-600">Billing records could not be loaded.</div>
        ) : isLoading ? (
          <div className="p-10 text-center text-slate-500">Loading payment records…</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No matching payment records.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Tenant / invoice</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Legal acceptance</th>
                  <th className="px-5 py-3">Payment evidence</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Email / detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => {
                  const tenant = tenantLabel(record);
                  const plan = planLabel(record);
                  const eventTime =
                    record.refundedAt || record.failedAt || record.paidAt || record.createdAt;
                  const emailSent =
                    record.successEmailSentAt ||
                    record.failureEmailSentAt ||
                    record.refundEmailSentAt;
                  return (
                    <tr key={record._id} className="align-top hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{tenant}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {record.invoiceNumber}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-slate-800">{plan}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {record.billingPeriod === 'one_time'
                            ? 'Lifetime'
                            : record.billingPeriod === 'month'
                              ? 'Monthly'
                              : 'Yearly'}
                          {record.licensedUserCount
                            ? ` · ${record.licensedUserCount.toLocaleString('en-IN')} users`
                            : ''}
                          {record.addonSlugs?.length
                            ? ` · ${record.addonSlugs.length} add-ons`
                            : ''}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {money(record.amountInPaise)}
                        </p>
                        {record.refundAmountInPaise ? (
                          <p className="mt-1 text-xs text-amber-700">
                            Refund {money(record.refundAmountInPaise)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyle[record.status]}`}
                        >
                          {record.status === 'created' ? 'Pending' : record.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {record.agreement?.acceptedAt &&
                        record.agreement.ndaAccepted &&
                        record.agreement.termsAccepted ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              <CircleCheck className="h-3.5 w-3.5" /> Verified
                            </span>
                            <p className="mt-1 text-[11px] text-slate-500">
                              NDA + terms · {timestamp(record.agreement.acceptedAt)}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                            <Clock3 className="h-3.5 w-3.5" /> Awaiting acceptance
                          </span>
                        )}
                      </td>
                      <td className="max-w-64 px-5 py-4 font-mono text-[11px] text-slate-500">
                        {record.transferReference && <p>UTR: {record.transferReference}</p>}
                        {record.paymentProofUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewerFile({
                                url: record.paymentProofUrl!,
                                name: `Payment proof · ${record.invoiceNumber}`,
                                mimeType: record.paymentProofMimeType,
                              })
                            }
                            className="mt-2 inline-flex items-center gap-1 font-sans text-xs font-semibold text-primary"
                          >
                            View proof <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                        {timestamp(eventTime)}
                      </td>
                      <td className="max-w-72 px-5 py-4">
                        <p
                          className={`text-xs font-semibold ${emailSent ? 'text-emerald-700' : 'text-slate-500'}`}
                        >
                          {emailSent ? `Email sent ${timestamp(emailSent)}` : 'Email pending'}
                        </p>
                        {record.failureDescription && (
                          <p className="mt-1 text-xs text-red-600">{record.failureDescription}</p>
                        )}
                        <p
                          className="mt-1 truncate text-xs text-slate-500"
                          title={record.billingEmail}
                        >
                          {record.billingEmail}
                        </p>
                        {record.reviewRemarks && (
                          <p className="mt-1 text-xs text-slate-600">{record.reviewRemarks}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => selectDetail(record)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-primary"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View details
                        </button>
                        {record.status === 'submitted' && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => void review(record, 'approve')}
                              disabled={reviewingId !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {reviewingId === record._id && (
                                <span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                              )}
                              {reviewingId === record._id
                                ? 'Approving…'
                                : record.amountInPaise === 0
                                  ? 'Approve workspace'
                                  : 'Approve'}
                            </button>
                            <button
                              onClick={() => void review(record, 'reject')}
                              disabled={reviewingId !== null}
                              className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!error && !isLoading && pagination.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total.toLocaleString('en-IN')} records
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous billing page"
                disabled={pagination.page <= 1 || recordsQuery.isValidating}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-xl bg-slate-100 p-2.5 text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-28 text-center text-sm font-semibold text-slate-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                type="button"
                aria-label="Next billing page"
                disabled={pagination.page >= pagination.pages || recordsQuery.isValidating}
                onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
                className="rounded-xl bg-slate-100 p-2.5 text-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      <Drawer
        anchor="right"
        open={Boolean(detailRecord)}
        onClose={closeDetail}
        slotProps={{
          paper: { className: 'w-full max-w-2xl bg-white' },
          backdrop: { className: 'bg-slate-950/35 backdrop-blur-[2px]' },
        }}
      >
        {detailRecord && (
          <div className="flex h-dvh min-h-0 flex-col bg-white">
            <header className="flex items-start justify-between gap-4 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  Payment details
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {detailRecord.invoiceNumber}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{tenantLabel(detailRecord)}</p>
              </div>
              <button
                type="button"
                aria-label="Close payment details"
                onClick={closeDetail}
                className="rounded-xl bg-slate-100 p-2.5 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/60 px-5 py-6 sm:px-7">
              <section className="rounded-3xl bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">Total amount</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {money(detailRecord.amountInPaise)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusStyle[detailRecord.status]}`}
                  >
                    {detailRecord.status === 'created' ? 'Pending' : detailRecord.status}
                  </span>
                </div>
                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
                  {(detailRecord.lineItems ?? []).map((item) => (
                    <div key={`${item.kind}-${item.slug}`} className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        {item.description} · {item.billingLabel}
                      </span>
                      <strong className="text-slate-800">{money(item.amountInPaise)}</strong>
                    </div>
                  ))}
                  {Boolean(detailRecord.lineItems?.length) && (
                    <div className="border-t border-slate-100" />
                  )}
                  {[
                    ['Subscription list price', detailRecord.listPriceInPaise],
                    [
                      'Annual discount',
                      Math.max(
                        0,
                        (detailRecord.discountInPaise ?? 0) -
                          (detailRecord.couponDiscountInPaise ?? 0),
                      ),
                    ],
                    [
                      detailRecord.couponCode
                        ? `Coupon (${detailRecord.couponCode})`
                        : 'Coupon discount',
                      detailRecord.couponDiscountInPaise,
                    ],
                    ['Taxable value', detailRecord.subtotalInPaise],
                    [`GST (${detailRecord.taxRatePercent ?? 0}%)`, detailRecord.taxAmountInPaise],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between gap-4">
                      <span className="text-slate-500">{label}</span>
                      <strong className="text-slate-800">{money(Number(value ?? 0))}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl bg-white p-5">
                <h3 className="font-bold text-slate-900">Billing and payment</h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    ['Plan', planLabel(detailRecord)],
                    [
                      'Billing period',
                      detailRecord.billingPeriod === 'one_time'
                        ? 'Lifetime'
                        : detailRecord.billingPeriod === 'month'
                          ? 'Monthly'
                          : 'Yearly',
                    ],
                    ['Billing email', detailRecord.billingEmail],
                    [
                      'Payment method',
                      detailRecord.paymentChannel?.toUpperCase() ||
                        detailRecord.paymentMethod.replace('_', ' '),
                    ],
                    ['Transaction / UTR', detailRecord.transferReference || '—'],
                    ['Payment date', timestamp(detailRecord.paymentDate)],
                    ['Submitted', timestamp(detailRecord.submittedAt)],
                    ['Reviewed', timestamp(detailRecord.reviewedAt)],
                    ['Created', timestamp(detailRecord.createdAt)],
                    ['Paid', timestamp(detailRecord.paidAt)],
                    ['Failed', timestamp(detailRecord.failedAt)],
                    ['Refunded', timestamp(detailRecord.refundedAt)],
                    [
                      'Reviewed by',
                      typeof detailRecord.reviewedBy === 'string'
                        ? detailRecord.reviewedBy
                        : detailRecord.reviewedBy?.name || detailRecord.reviewedBy?.email || '—',
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {label}
                      </dt>
                      <dd className="mt-1 break-all text-sm font-semibold text-slate-700">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {detailRecord.reviewRemarks && (
                  <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    {detailRecord.reviewRemarks}
                  </p>
                )}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    References and delivery
                  </h4>
                  <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                    {[
                      ['Invoice number', detailRecord.invoiceNumber],
                      ['Purchase type', detailRecord.purchaseKind || 'plan'],
                      [
                        'Licensed users',
                        detailRecord.licensedUserCount?.toLocaleString('en-IN') || '—',
                      ],
                      ['Selected add-ons', detailRecord.addonSlugs?.join(', ') || 'None'],
                      ['Proof content type', detailRecord.paymentProofMimeType || '—'],
                      ['Success email', timestamp(detailRecord.successEmailSentAt)],
                      ['Failure email', timestamp(detailRecord.failureEmailSentAt)],
                      ['Refund email', timestamp(detailRecord.refundEmailSentAt)],
                      [
                        'Failure reason',
                        detailRecord.failureDescription || detailRecord.failureCode || '—',
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {label}
                        </dt>
                        <dd className="mt-1 break-all text-sm font-semibold text-slate-700">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              <section className="rounded-xl bg-white p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">Legal acceptance</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      OTP verification evidence and protected copies accepted by the tenant.
                    </p>
                  </div>
                </div>
                {detailRecord.agreement?.acceptedAt ? (
                  <>
                    <dl className="mt-6 grid gap-x-6 gap-y-5 rounded-lg bg-slate-50 p-5 sm:grid-cols-2">
                      {[
                        ['Acceptance ID', detailRecord.agreement.acceptanceId || '—'],
                        [
                          'Authorized signatory',
                          `${detailRecord.agreement.signatoryName}, ${detailRecord.agreement.signatoryDesignation}`,
                        ],
                        ['Verified email', detailRecord.agreement.email],
                        ['OTP sent', timestamp(detailRecord.agreement.otpSentAt)],
                        ['OTP verified', timestamp(detailRecord.agreement.otpVerifiedAt)],
                        ['Accepted', timestamp(detailRecord.agreement.acceptedAt)],
                        ['OTP attempts', String(detailRecord.agreement.otpAttempts)],
                        [
                          'Authority confirmed',
                          detailRecord.agreement.signatoryAuthorityConfirmed ? 'Yes' : 'No',
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {label}
                          </dt>
                          <dd className="mt-1 break-all text-sm font-semibold text-slate-700">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-6 grid gap-4">
                      {[
                        {
                          kind: 'nda' as const,
                          title: detailRecord.agreement.ndaTitle,
                          version: detailRecord.agreement.ndaVersion,
                          hash: detailRecord.agreement.ndaHash,
                        },
                        {
                          kind: 'terms' as const,
                          title: detailRecord.agreement.termsTitle,
                          version: detailRecord.agreement.termsVersion,
                          hash: detailRecord.agreement.termsHash,
                        },
                      ].map((document) => (
                        <div key={document.kind} className="rounded-lg bg-slate-50 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                                {document.kind === 'nda' ? 'NDA' : 'Terms & Conditions'}
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-800">
                                {document.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Version {document.version}
                              </p>
                            </div>
                            <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                          </div>
                          <p className="mt-3 break-all rounded-md bg-white px-3 py-2 font-mono text-[10px] text-slate-500">
                            SHA-256 {document.hash}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={agreementLoading !== null}
                              onClick={() => void openAgreement(document.kind, false)}
                              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-primary disabled:cursor-wait disabled:opacity-60"
                            >
                              {agreementLoading === document.kind ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              {agreementLoading === document.kind ? 'Preparing PDF…' : 'View PDF'}
                            </button>
                            <button
                              type="button"
                              disabled={agreementLoading !== null}
                              onClick={() => void openAgreement(document.kind, true)}
                              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60"
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </button>
                          </div>
                          {agreementError?.kind === document.kind && (
                            <div className="mt-4 rounded-lg bg-red-50 p-4">
                              <p className="text-xs font-semibold leading-5 text-red-700">
                                {agreementError.message}
                              </p>
                              <button
                                type="button"
                                disabled={agreementLoading !== null}
                                onClick={() => void openAgreement(document.kind, false)}
                                className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-red-700 disabled:opacity-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Retry this document
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No completed OTP-verified legal acceptance is attached to this payment.
                  </p>
                )}
              </section>

              <section className="rounded-3xl bg-white p-5">
                <h3 className="font-bold text-slate-900">Documents</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  {detailRecord.paymentProofUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setViewerFile({
                          url: detailRecord.paymentProofUrl!,
                          name: `Payment proof · ${detailRecord.invoiceNumber}`,
                          mimeType: detailRecord.paymentProofMimeType,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700"
                    >
                      <Eye className="h-4 w-4" />
                      View payment proof
                    </button>
                  )}
                  {['paid', 'refunded'].includes(detailRecord.status) && (
                    <>
                      <button
                        type="button"
                        onClick={() => void openInvoice(false)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-primary"
                      >
                        <Eye className="h-4 w-4" />
                        View invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => void openInvoice(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
                      </button>
                    </>
                  )}
                </div>
                {!['paid', 'refunded'].includes(detailRecord.status) && (
                  <p className="mt-3 text-xs text-slate-500">
                    The official invoice becomes available after payment approval.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        anchor="right"
        open={couponsOpen}
        onClose={() => setCouponsOpen(false)}
        slotProps={{
          paper: { className: 'w-full max-w-2xl bg-white' },
          backdrop: { className: 'bg-slate-950/35 backdrop-blur-[2px]' },
        }}
      >
        <div className="flex h-dvh min-h-0 flex-col bg-white">
          <header className="flex items-start justify-between gap-4 px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                <TicketPercent className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  Promotions
                </p>
                <h2 className="text-lg font-bold text-slate-900">Personalized coupons</h2>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close coupon manager"
              onClick={() => setCouponsOpen(false)}
              className="rounded-xl bg-slate-100 p-2.5 text-slate-500"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-5 py-6 sm:px-7">
            <article className="rounded-3xl bg-white p-5">
              <h3 className="font-bold text-slate-900">Create coupon</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Discounts are deducted before the separately configured GST is calculated.
              </p>
              <form onSubmit={createCoupon} className="mt-5 grid gap-3 sm:grid-cols-2">
                <input
                  required
                  name="code"
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
                  placeholder="Coupon code"
                  className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm uppercase outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  name="discountType"
                  className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount (₹)</option>
                </select>
                <input
                  required
                  name="discountValue"
                  type="number"
                  min={1}
                  step="0.01"
                  placeholder="Discount value"
                  className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  name="maxRedemptions"
                  type="number"
                  min={1}
                  placeholder="Usage limit"
                  className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  name="assignedEmail"
                  type="email"
                  placeholder="Assigned billing email"
                  className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  name="assignedTenantId"
                  className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm lowercase outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All workspaces</option>
                  {(tenants.data?.data ?? [])
                    .filter((tenant) => tenant.status !== 'provisioning_failed')
                    .sort((left, right) => left.name.localeCompare(right.name))
                    .map((tenant) => (
                      <option key={tenant._id} value={tenant.tenantId}>
                        {tenant.name} · {tenant.tenantId}
                      </option>
                    ))}
                </select>
                <input
                  name="expiresAt"
                  type="datetime-local"
                  className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {isSaving ? 'Creating…' : 'Create coupon'}
                </button>
                <input
                  name="description"
                  maxLength={240}
                  placeholder="Internal description (optional)"
                  className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary sm:col-span-2"
                />
              </form>
            </article>

            <div className="mt-5 space-y-3">
              {(coupons.data?.data ?? []).map((coupon) => (
                <article key={coupon._id} className="rounded-2xl bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-bold text-slate-900">{coupon.code}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}% off`
                          : `${money(coupon.discountValue)} off`}
                        {' · '}
                        {coupon.redemptionCount}/{coupon.maxRedemptions ?? '∞'} used
                      </p>
                      {(coupon.assignedEmail || coupon.assignedTenantId) && (
                        <p className="mt-1 text-xs text-primary">
                          Assigned to {coupon.assignedEmail || coupon.assignedTenantId}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={coupon.isActive}
                      aria-label={`${coupon.isActive ? 'Disable' : 'Enable'} ${coupon.code}`}
                      onClick={() => void toggleCoupon(coupon._id, !coupon.isActive)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                        coupon.isActive ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                          coupon.isActive ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                </article>
              ))}
              {!coupons.data?.data?.length && (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
                  No coupons created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </Drawer>

      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        slotProps={{
          paper: { className: 'w-full max-w-2xl bg-white' },
          backdrop: { className: 'bg-slate-950/35 backdrop-blur-[2px]' },
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="billing-settings-title"
          className="flex h-dvh min-h-0 flex-col bg-white"
        >
          <header className="flex flex-none items-start justify-between gap-4 px-5 py-5 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-2">
                {BANKS.find((bank) => bank.name === selectedBank) ? (
                  <Image
                    src={BANKS.find((bank) => bank.name === selectedBank)!.logo}
                    alt={`${selectedBank} logo`}
                    width={28}
                    height={28}
                    unoptimized
                    className="h-7 w-7 object-contain"
                  />
                ) : (
                  <Landmark className="h-6 w-6 text-primary" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  Payment setup
                </p>
                <h2
                  id="billing-settings-title"
                  className="truncate text-lg font-bold text-slate-900"
                >
                  Platform invoice billing
                </h2>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close billing settings"
              onClick={() => setSettingsOpen(false)}
              className="rounded-xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <form
            key={JSON.stringify(settings.data?.data ?? {})}
            onSubmit={saveSettings}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-5 py-6 sm:px-7">
              <article className="mb-5 overflow-hidden rounded-3xl bg-slate-50">
                <header className="bg-linear-to-br from-blue-50 to-cyan-100 p-5">
                  <div className="flex items-center justify-between gap-5">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Bank transfer</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        Verified subscription payments
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Customers receive these beneficiary details only inside their secure,
                        token-bound checkout.
                      </p>
                    </div>
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-2">
                      {BANKS.find((bank) => bank.name === selectedBank) ? (
                        <Image
                          src={BANKS.find((bank) => bank.name === selectedBank)!.logo}
                          alt={`${selectedBank} logo`}
                          width={38}
                          height={38}
                          unoptimized
                          className="h-9 w-9 object-contain"
                        />
                      ) : (
                        <Landmark className="h-7 w-7 text-primary" />
                      )}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['Bank transfer', 'Proof review', 'Controlled activation'].map((feature) => (
                      <span
                        key={feature}
                        className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </header>
              </article>

              <div className="mb-5 grid grid-cols-3 items-center gap-2 text-center text-[11px] font-semibold text-slate-500">
                {['Select bank', 'Add account', 'Enable checkout'].map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              <fieldset>
                <legend className="text-xs font-bold text-slate-600">Select your bank</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BANKS.map((bank) => {
                    const active = selectedBank === bank.name;
                    return (
                      <button
                        key={bank.name}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedBank(bank.name)}
                        className={`flex min-h-16 items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs font-semibold transition ${
                          active
                            ? 'bg-blue-100 text-primary ring-2 ring-primary'
                            : 'bg-white text-slate-700 hover:bg-blue-50'
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
                          <Image
                            src={bank.logo}
                            alt={`${bank.name} logo`}
                            width={28}
                            height={28}
                            unoptimized
                            className="h-7 w-7 object-contain"
                          />
                        </span>
                        <span className="line-clamp-2">{bank.name}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={selectedBank === 'Other bank'}
                    onClick={() => setSelectedBank('Other bank')}
                    className={`flex min-h-16 items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs font-semibold transition ${
                      selectedBank === 'Other bank'
                        ? 'bg-blue-100 text-primary ring-2 ring-primary'
                        : 'bg-white text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <Landmark className="h-5 w-5" />
                    </span>
                    Other bank
                  </button>
                </div>
              </fieldset>

              {selectedBank === 'Other bank' && (
                <label className="mt-4 block text-xs font-bold text-slate-600">
                  Bank name
                  <input
                    required
                    value={customBankName}
                    onChange={(event) => setCustomBankName(event.target.value)}
                    className="mt-1.5 w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
                  />
                </label>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  ['accountHolderName', 'Account holder', settings.data?.data?.accountHolderName],
                  ['accountNumber', 'Account number', settings.data?.data?.accountNumber],
                  ['ifscCode', 'IFSC code', settings.data?.data?.ifscCode],
                  ['branch', 'Branch (optional)', settings.data?.data?.branch],
                  ['upiId', 'UPI ID (optional)', settings.data?.data?.upiId],
                ].map(([name, label, value]) => (
                  <label key={name} className="text-xs font-semibold text-slate-600">
                    {label}
                    <input
                      required={!['branch', 'upiId'].includes(String(name))}
                      name={name}
                      defaultValue={value}
                      autoComplete="off"
                      className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:bg-white focus:ring-2"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-800">Tax invoice identity</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  These values are snapshotted into new subscription invoices.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                    Registered legal name
                    <input
                      name="legalName"
                      defaultValue={settings.data?.data?.legalName}
                      autoComplete="organization"
                      className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:bg-white focus:ring-2"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    GSTIN
                    <input
                      name="gstin"
                      defaultValue={settings.data?.data?.gstin}
                      pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][A-Za-z0-9]Z[A-Za-z0-9]"
                      placeholder="22AAAAA0000A1Z5"
                      className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm uppercase outline-none ring-primary focus:bg-white focus:ring-2"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Registered state
                    <input
                      name="state"
                      defaultValue={settings.data?.data?.state}
                      className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:bg-white focus:ring-2"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    GST rate (%)
                    <input
                      required
                      type="number"
                      name="taxRatePercent"
                      min={0}
                      max={100}
                      step="0.01"
                      defaultValue={settings.data?.data?.taxRatePercent ?? 18}
                      className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:bg-white focus:ring-2"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Authorized signatory
                    <input
                      name="authorizedSignatoryName"
                      defaultValue={
                        settings.data?.data?.authorizedSignatoryName ?? 'Rajesh Kumar Behera'
                      }
                      className="mt-1.5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:bg-white focus:ring-2"
                    />
                  </label>
                </div>
              </div>
              <label className="mt-4 block text-xs font-semibold text-slate-600">
                Payer instructions
                <textarea
                  name="instructions"
                  defaultValue={settings.data?.data?.instructions}
                  rows={5}
                  className="mt-1.5 w-full resize-none rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none ring-primary focus:bg-white focus:ring-2"
                />
              </label>
              <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Enable invoice payments</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Paid checkout remains blocked until valid beneficiary details are saved.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={billingEnabled}
                  aria-label="Enable invoice payments"
                  onClick={() => setBillingEnabled((enabled) => !enabled)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition duration-200 focus:outline-none focus:ring-4 focus:ring-primary/15 ${
                    billingEnabled ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                      billingEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <footer className="flex flex-none justify-end gap-3 bg-white px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={isSaving}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save billing details'}
              </button>
            </footer>
          </form>
        </div>
      </Drawer>
      <FileViewer
        open={Boolean(viewerFile)}
        onClose={() => setViewerFile(null)}
        files={viewerFile ? [viewerFile] : []}
        title={viewerFile?.name}
      />
    </div>
  );
}

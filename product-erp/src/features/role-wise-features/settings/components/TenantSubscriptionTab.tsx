'use client';

import { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Download,
  GraduationCap,
  Landmark,
  LoaderCircle,
  PackagePlus,
  ReceiptIndianRupee,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'react-toastify';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import CustomButton from '@/shared/core/CustomButton';
import { downloadPdf } from '@/shared/utils/pdfDownload';

type TBillingPeriod = 'month' | 'year' | 'one_time';
type TPaymentStatus =
  | 'created'
  | 'submitted'
  | 'paid'
  | 'rejected'
  | 'failed'
  | 'refunded'
  | 'cancelled';

interface IPlan {
  _id: string;
  name: string;
  slug: string;
  description: string;
  billingPeriod: TBillingPeriod;
  studentLimit: number;
  employeeLimit: number;
  highlights: string[];
}

interface IAddon {
  _id: string;
  name: string;
  slug: string;
  description: string;
  amountInPaise: number;
  monthlyAmountInPaise: number;
  billingPeriod: TBillingPeriod;
  availableBillingPeriods: TBillingPeriod[];
  moduleSlugs: string[];
  featureKeys: string[];
  capacityBoost?: {
    additionalStudents: number;
    additionalEmployees: number;
  };
  meetingLimitBoost?: {
    additionalParticipants: number;
    additionalMonthlyMinutes: number;
    additionalConcurrentMeetings: number;
    additionalRecordingStorageMb: number;
    additionalRetentionDays: number;
    enableRecording: boolean;
  };
}

interface IAddonOrder {
  billingId: string;
  amount: number;
  invoiceNumber: string;
  lineItems: Array<{ description: string; amountInPaise: number }>;
  bankTransfer: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch?: string;
    upiId?: string;
  };
}

interface IPayment {
  _id: string;
  invoiceNumber: string;
  amountInPaise: number;
  status: TPaymentStatus;
  billingPeriod: TBillingPeriod;
  purchaseKind: 'plan' | 'addon';
  razorpayPaymentId?: string;
  paidAt?: string;
  createdAt: string;
}

interface ISubscriptionOverview {
  subscription: {
    plan?: IPlan | null;
    status: 'trialing' | 'pending_payment' | 'active' | 'past_due' | 'free' | 'cancelled';
    expiresAt?: string;
    trialEndsAt?: string;
    graceEndsAt?: string;
    billingEmail?: string;
    maxStudents?: number;
    maxEmployees?: number;
    enabledAddonSlugs: string[];
    unlimitedMeetingsUntil?: string;
    unlimitedMeetingsActive: boolean;
  };
  enabledAddons: IAddon[];
  availableAddons: IAddon[];
  payments: IPayment[];
}

const money = (amountInPaise: number) =>
  `₹${(amountInPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const date = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not scheduled';

export default function TenantSubscriptionTab() {
  const {
    data: response,
    isLoading,
    error,
    mutate,
  } = useSwr<{ data?: ISubscriptionOverview }>('tenant-subscription');
  const { mutation, isLoading: isMutating } = useMutation();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [orderingSlug, setOrderingSlug] = useState<string | null>(null);
  const [addonOrder, setAddonOrder] = useState<IAddonOrder | null>(null);
  const [transferReference, setTransferReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const overview = response?.data;
  const current = overview?.subscription;
  const plan = current?.plan;

  const createAddonOrder = async (addon: IAddon) => {
    setOrderingSlug(addon.slug);
    const response = await mutation(`tenant-subscription/addons/${addon.slug}/order`, {
      method: 'POST',
      body: {},
      isAlert: true,
      dedupe: false,
    });
    const order = (response?.results as { data?: IAddonOrder } | undefined)?.data;
    if (order) setAddonOrder(order);
    setOrderingSlug(null);
  };

  const resumeAddonOrder = async (payment: IPayment) => {
    const response = await mutation(`tenant-subscription/addons/orders/${payment._id}`, {
      method: 'GET',
      dedupe: false,
    });
    const order = (response?.results as { data?: IAddonOrder } | undefined)?.data;
    if (order) setAddonOrder(order);
  };

  const submitAddonProof = async () => {
    if (!addonOrder || !proof) return;
    const body = new FormData();
    body.set('billingId', addonOrder.billingId);
    body.set('transferReference', transferReference);
    body.set('paymentDate', paymentDate);
    body.set('proof', proof);
    const response = await mutation('tenant-subscription/addons/payment-proof', {
      method: 'POST',
      body,
      isFormData: true,
      isAlert: true,
      dedupe: false,
    });
    if (!response) return;
    setAddonOrder(null);
    setTransferReference('');
    setPaymentDate('');
    setProof(null);
    await mutate();
  };

  const downloadInvoice = async (payment: IPayment) => {
    setDownloadingId(payment._id);
    const downloaded = await downloadPdf(
      `tenant-subscription/invoices/${payment._id}`,
      `${payment.status === 'refunded' ? 'credit-note' : 'invoice'}-${payment.invoiceNumber}.pdf`,
    );
    if (!downloaded) toast.error('The invoice could not be downloaded. Please try again.');
    setDownloadingId(null);
  };

  if (isLoading) return <div className="h-72 animate-pulse rounded-2xl bg-slate-50" />;

  if (error || !overview) {
    return (
      <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">
        Subscription information could not be loaded. Refresh the page and try again.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Subscription &amp; billing</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review your current plan, capacity upgrades, payments and official invoices.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl bg-primary p-5 text-white sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium capitalize">
              {current?.status.replace('_', ' ')}
            </span>
            <h3 className="mt-3 text-2xl font-semibold">{plan?.name ?? 'Plan not assigned'}</h3>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              {plan?.description ?? 'Contact platform support to assign a subscription plan.'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-xs text-white/60">
              {current?.status === 'trialing' ? 'Trial ends' : 'Next renewal'}
            </p>
            <p className="mt-1 font-semibold">
              {date(current?.status === 'trialing' ? current.trialEndsAt : current?.expiresAt)}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PlanMetric
            icon={<GraduationCap className="h-4 w-4" />}
            label="Student capacity"
            value={(current?.maxStudents ?? plan?.studentLimit ?? 0).toLocaleString('en-IN')}
          />
          <PlanMetric
            icon={<Users className="h-4 w-4" />}
            label="Employee capacity"
            value={(current?.maxEmployees ?? plan?.employeeLimit ?? 0).toLocaleString('en-IN')}
          />
          <PlanMetric
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Billing email"
            value={current?.billingEmail ?? 'Not configured'}
          />
          <PlanMetric
            icon={<CalendarClock className="h-4 w-4" />}
            label="Unlimited live meetings"
            value={
              current?.unlimitedMeetingsActive && current.unlimitedMeetingsUntil
                ? `Until ${date(current.unlimitedMeetingsUntil)}`
                : 'Plan limits apply'
            }
          />
        </div>
      </section>

      {overview.enabledAddons.length > 0 && (
        <section>
          <h3 className="text-base font-semibold text-slate-900">Active add-ons</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {overview.enabledAddons.map((addon) => (
              <div key={addon._id} className="flex gap-3 rounded-2xl bg-emerald-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{addon.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{addon.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Available add-ons</h3>
          <p className="mt-1 text-xs text-slate-500">
            Only upgrades not already included in your plan are shown.
          </p>
        </div>
        {overview.availableAddons.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {overview.availableAddons.map((addon) => (
              <div key={addon._id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <PackagePlus className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{addon.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{addon.description}</p>
                    <p className="mt-2 text-xs font-semibold text-primary">
                      {addon.availableBillingPeriods.includes('month') &&
                      addon.monthlyAmountInPaise > 0
                        ? `${money(addon.monthlyAmountInPaise)} / month`
                        : `${money(addon.amountInPaise)} / ${addon.billingPeriod}`}
                    </p>
                    <p className="mt-2 text-[11px] leading-4 text-slate-500">
                      {addon.capacityBoost?.additionalStudents
                        ? `Adds ${addon.capacityBoost.additionalStudents.toLocaleString('en-IN')} student places. `
                        : ''}
                      {addon.capacityBoost?.additionalEmployees
                        ? `Adds ${addon.capacityBoost.additionalEmployees.toLocaleString('en-IN')} employee places. `
                        : ''}
                      {addon.meetingLimitBoost?.additionalParticipants
                        ? `Adds ${addon.meetingLimitBoost.additionalParticipants.toLocaleString('en-IN')} meeting participants. `
                        : ''}
                      {addon.moduleSlugs.length
                        ? `Applies to ${addon.moduleSlugs.join(', ')}.`
                        : 'Applies to your current institution workspace.'}
                    </p>
                  </div>
                </div>
                <CustomButton
                  fullWidth
                  disabled={isMutating || orderingSlug !== null}
                  loading={orderingSlug === addon.slug}
                  loadingText="Creating invoice…"
                  onClick={() => void createAddonOrder(addon)}
                  startIcon={<PackagePlus className="h-4 w-4" />}
                  className="mt-4"
                >
                  Purchase add-on
                </CustomButton>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
            Every currently available upgrade is already included or active.
          </div>
        )}
      </section>

      {addonOrder && (
        <section className="rounded-2xl bg-primary-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
              <Landmark className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Complete add-on payment</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Invoice {addonOrder.invoiceNumber}. Transfer the exact total below. The add-on
                becomes available only after Devvelocity verifies the payment.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2">
            {addonOrder.lineItems.map((item) => (
              <div key={item.description}>
                <p className="text-xs text-slate-500">{item.description}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {money(item.amountInPaise)}
                </p>
              </div>
            ))}
            <div>
              <p className="text-xs text-slate-500">Total payable including tax</p>
              <p className="mt-1 text-lg font-bold text-primary">{money(addonOrder.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Beneficiary</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {addonOrder.bankTransfer.accountHolderName}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Bank and account</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {addonOrder.bankTransfer.bankName} · {addonOrder.bankTransfer.accountNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">IFSC / UPI</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {addonOrder.bankTransfer.ifscCode}
                {addonOrder.bankTransfer.upiId ? ` · ${addonOrder.bankTransfer.upiId}` : ''}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Bank transaction reference / UTR
              <input
                value={transferReference}
                minLength={8}
                maxLength={50}
                onChange={(event) =>
                  setTransferReference(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                }
                className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Payment date
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </label>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl bg-white p-4">
            <Upload className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 text-xs text-slate-600">
              <strong className="block truncate text-slate-800">
                {proof?.name ?? 'Upload payment proof'}
              </strong>
              PDF, PNG, JPG or WEBP · maximum 5 MB
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setProof(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <CustomButton
              fullWidth={false}
              disabled={
                isMutating || !proof || transferReference.length < 8 || paymentDate.length === 0
              }
              loading={isMutating}
              loadingText="Submitting proof…"
              onClick={() => void submitAddonProof()}
              startIcon={<ShieldCheck className="h-4 w-4" />}
            >
              Submit for verification
            </CustomButton>
            <CustomButton
              variant="secondary"
              fullWidth={false}
              disabled={isMutating}
              onClick={() => setAddonOrder(null)}
            >
              Finish later
            </CustomButton>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            This add-on is billed for the displayed term and applies after payment approval. It does
            not change features already included in your base plan.
          </p>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2">
          <ReceiptIndianRupee className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-slate-900">Payment history</h3>
        </div>
        {overview.payments.length > 0 ? (
          <div className="mt-3 space-y-2">
            {overview.payments.map((payment) => {
              const invoiceAvailable = payment.status === 'paid' || payment.status === 'refunded';
              return (
                <div
                  key={payment._id}
                  className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
                      <CalendarClock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">
                          {payment.invoiceNumber}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            payment.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : payment.status === 'refunded'
                                ? 'bg-amber-100 text-amber-700'
                                : payment.status === 'failed'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {payment.purchaseKind === 'addon' ? 'Add-on purchase' : 'Plan purchase'} ·{' '}
                        {date(payment.paidAt ?? payment.createdAt)}
                        {payment.razorpayPaymentId ? ` · ${payment.razorpayPaymentId}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <p className="text-sm font-semibold text-slate-900">
                      {money(payment.amountInPaise)}
                    </p>
                    {invoiceAvailable && (
                      <CustomButton
                        variant="secondary"
                        fullWidth={false}
                        disabled={downloadingId !== null}
                        onClick={() => void downloadInvoice(payment)}
                        startIcon={
                          downloadingId === payment._id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )
                        }
                      >
                        Invoice
                      </CustomButton>
                    )}
                    {payment.purchaseKind === 'addon' &&
                      ['created', 'rejected'].includes(payment.status) && (
                        <CustomButton
                          variant="secondary"
                          fullWidth={false}
                          disabled={isMutating}
                          onClick={() => void resumeAddonOrder(payment)}
                        >
                          Continue payment
                        </CustomButton>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
            No subscription payments have been recorded yet.
          </div>
        )}
      </section>
    </div>
  );
}

function PlanMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <span className="text-white/70">{icon}</span>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-white/55">{label}</p>
    </div>
  );
}
